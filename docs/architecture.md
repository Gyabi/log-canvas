# アーキテクチャ概要

> 本ドキュメントはコードの現状を正確に記述したものです。後半の「設計レビュー」は自己批評として問題点と改善案を列挙しています。

---

## 1. ノード一覧

### 1.1 SourceLogViewNode

| 項目 | 内容 |
|---|---|
| ファイル | `src/components/log-view/SourceLogViewNode.tsx` |
| 役割 | DLT ファイルを開き、全メッセージを仮想スクロールで表示する。グラフの起点。 |
| ハンドル | source (右) のみ — 下流の条件ノードへ接続できる |
| node.data 型 | `SourceLogViewData { viewId?, rowCount?, jumpRequest? }` |

**できること**
- 「open」ボタンでファイル選択ダイアログを開き DLT ファイルをロード
- タイムスタンプ表示モード切替（ABS / REL / μs）
- 行クリック選択・Shift/Ctrl 複数選択・クリップボードコピー
- フッターの行数クリックで行ジャンプ入力
- `jumpRequest` を受け取ったとき指定行へスクロール（DerivedLogViewNode からのダブルクリック起点）

---

### 1.2 DerivedLogViewNode

| 項目 | 内容 |
|---|---|
| ファイル | `src/components/log-view/DerivedLogViewNode.tsx` |
| 役割 | 条件ノードが適用された結果を表示する。フィルタ・マーキング両方に対応。 |
| ハンドル | target (左) + source (右) — 条件ノードから受け取り、さらに下流へ渡せる |
| node.data 型 | `DerivedLogViewData { sourceViewId, viewId, rowCount, label?, markingRules?, jumpRequest? }` |

`sourceViewId` と `viewId` の使い分けが重要：

| フィールド | 意味 | 変化するタイミング |
|---|---|---|
| `sourceViewId` | 生成時に確定した上流 view ID。Rust の `create_view` に渡す `source_view_id`。 | 変化しない |
| `viewId` | 現在 Rust に存在する view の ID。フィルタが変わるたびに新 UUID に差し替える。 | フィルタ再適用のたび |

**できること**
- SourceLogViewNode と同じ表示操作（TS モード、選択、コピー、行ジャンプ）
- マーキングルールによる行カラーハイライト（フロントエンドのみ、Rust 通信なし）
- 行ダブルクリックで親ビューの対応行へジャンプリクエストを送信
- 接続された条件ノードが変化したとき自動で再適用（`useDerivedViewSync` 経由）

---

### 1.3 FilterNode

| 項目 | 内容 |
|---|---|
| ファイル | `src/components/condition/FilterNode.tsx` |
| 役割 | フィルタ条件（AND 結合）を定義する。 |
| ハンドル | target (左) + source (右) |
| node.data 型 | `FilterNodeData { filters: DltFilter[] }` |

`DltFilter` のフィールド・演算子：

```
field: "ecuId" | "appId" | "ctxId" | "level" | "payload"
op:    "eq" | "neq" | "contains" | "regex"
value: string
```

**できること**
- フィルタチップの追加・削除
- 「Create Output →」で接続先の DerivedLogViewNode を生成（または既存を更新）
- ヘッダーに現在接続先の行数をリアルタイム表示（`useStore` セレクター購読）

---

### 1.4 MarkingNode

| 項目 | 内容 |
|---|---|
| ファイル | `src/components/condition/MarkingNode.tsx` |
| 役割 | 行カラーハイライトルールを定義する。 |
| ハンドル | target (左) + source (右) |
| node.data 型 | `MarkingNodeData { rules: MarkingRule[] }` |

`MarkingRule`:
```
{ field: string, op: string, value: string, color: "red"|"yellow"|"green"|"blue"|"purple" }
```

**できること**
- ルールチップの追加・削除・色選択
- 「Create Output →」でマーキングルールを適用した DerivedLogViewNode を生成（バックエンド通信なし）
- ヘッダーに適用済みルール数をリアルタイム表示

---

## 2. データフロー

### 2.1 ファイルオープンフロー

```
[ユーザー] ファイル選択
    ↓
open_dlt_file(path)                          [Rust]
    ↓ index_file(path) — ファイルスキャン
    ↓ storage header "DLT\x01" を探索
    ↓ 各メッセージのバイトオフセットを Vec<u64> に記録
    ↓ AppState.dlt_files[path] = DltFileState { path, offsets }
    → DltFileInfo { id: path, rowCount, path }
    ↓
updateNodeData(id, { viewId: path, rowCount })  [TS: SourceLogViewNode]
    ↓
useLogView(viewId, rowCount) が仮想スクロール開始
```

**ポイント**: `viewId === ファイルの絶対パス`。同じファイルを2つの SourceLogViewNode で開くと viewId が衝突する（後述の既知問題）。

---

### 2.2 仮想スクロール・行フェッチフロー

```
[ユーザー] スクロール
    ↓
useVirtualizer → virtualItems の rangeStart/rangeEnd が変化
    ↓
useEffect([viewId, rangeStart, rangeEnd, cacheState.entries])
    ↓ キャッシュに存在しない行インデックスを収集
    ↓
get_log_rows(viewId, offset, count=100)           [Rust]
    ↓ resolve_view(viewId) → (path, offsets[offset..offset+count])
    ↓ File::open(path) → 各バイトオフセットで parse_row_at
    → Vec<DltRow>
    ↓
dispatchCache({ type: "add", rows })              [TS: useLogView]
    ↓ immutable Map コピー + 新規行を追加
    ↓ (index === 0 なら firstTimestampUs を記録)
    → rowCache (Map<number, DltRow>) として LogViewDisplay に渡す
```

**キャッシュ戦略**: `useReducer` による immutable Map。viewId が変わると `"reset"` アクションでクリア。overscan=15 で先読み。

---

### 2.3 フィルタ適用フロー（「Create Output →」ボタン）

```
[ユーザー] FilterNode の「Create Output →」をクリック
    ↓
getEdges() で上流ノードの viewId (= sourceViewId) を取得
    ↓
create_view(newUUID, sourceViewId, filters)         [Rust]
    ↓ resolve_view(sourceViewId) → source_offsets
    ↓ apply_filters(source_offsets, path, filters)
       - regex は事前コンパイル（1回）
       - 各行を parse_row_at → DltFilter.matches_with(row)
       - AND 結合でパスした行のバイトオフセットを収集
    ↓ AppState.dlt_views[newUUID] = DltView { file_id, offsets }
    → filteredRowCount: u32
    ↓
addNodes([DerivedLogViewNode {                      [TS]
  data: { sourceViewId, viewId: newUUID, rowCount: filteredRowCount }
}])
addEdges([FilterNode → DerivedLogViewNode])
```

---

### 2.4 リアクティブ同期フロー（条件変化時の自動再適用）

`useDerivedViewSync` が担う。DerivedLogViewNode がマウントされるたびに動く。

```
useEdges() + useNodes()
    ↓ incomingEdges = edges.filter(e.target === myId)
    ↓ signature = incomingEdges.map(e =>
         `${e.source}:${JSON.stringify(sourceNode.data)}`
       ).sort().join("|")
    ↓
useEffect([signature])  ← signature が変化したときだけ発火
    ↓ isFirstRender.current === true → skip (初回マウントをスキップ)
    ↓
    [フィルタノードなし]
        → updateNodeData(id, { markingRules })   フロントのみ更新
    [フィルタノードあり]
        ↓
        create_view(newUUID, data.sourceViewId, allFilters)    [Rust]
        ↓
        if oldViewId !== sourceViewId: delete_view(oldViewId)  [Rust]
        ↓
        updateNodeData(id, { viewId: newUUID, rowCount, markingRules })
            → viewId が変わる → useLogView の cache reset effect 発火
            → 仮想スクロールが新ビューの行を取得し直す
```

**signature が変わる条件**:
- FilterNode の `filters` 追加/削除
- MarkingNode の `rules` 追加/削除
- 新たな条件ノードをエッジ接続
- 条件ノードをエッジ切断

---

### 2.5 マーキング適用フロー（フロントエンドのみ）

```
data.markingRules が更新される
    ↓
useMemo([lv.rowCache, data.markingRules])
    ↓ computeMarks(rowCache, rules)
       - rules の中で op === "regex" なら RegExp を事前コンパイル
       - rowCache.entries() をイテレート
       - 各行に対して先頭マッチしたルールの color を記録（first-match-wins）
    → Map<rowIndex, MarkColor>
    ↓
LogViewDisplay の marks prop として渡す
    → 行レンダリング時に MARK_BG[color] をクラスに付与
```

---

### 2.6 ダブルクリック行ジャンプフロー

```
[ユーザー] DerivedLogViewNode の行をダブルクリック
    ↓
onRowDoubleClick(derivedRowIndex)         [TS: DerivedLogViewNode]
    ↓
    [viewId === sourceViewId (フィルタなし)]
        → 親ノード(data.sourceViewId が viewId の node)を探す
        → updateNodeData(parentId, { jumpRequest: derivedRowIndex })
    [viewId !== sourceViewId (フィルタあり)]
        ↓
        get_source_row_index(viewId, derivedRowIndex, sourceViewId)  [Rust]
            ↓ DltView.offsets[derivedRowIndex] → byteOffset
            ↓ resolve_view(sourceViewId) → source_offsets
            ↓ source_offsets.binary_search(byteOffset)
            → sourceRowIndex: u32
        ↓
        親ノード(data.sourceViewId が viewId の node)を探す
        → updateNodeData(parentId, { jumpRequest: sourceRowIndex })
    ↓
[親ノードの useEffect([data.jumpRequest]) が発火]
    ↓ lv.scrollToIndex(data.jumpRequest)  ← 0-based, align: "center"
    ↓ updateNodeData(id, { jumpRequest: undefined })  ← クリア
```

---

## 3. TypeScript ↔ Rust インタラクション一覧

| コマンド | 引数 | 戻り値 | 処理内容 |
|---|---|---|---|
| `open_dlt_file` | `path: string` | `DltFileInfo` | ファイルをインデックス化し AppState に保存 |
| `get_log_rows` | `viewId, offset, count` | `DltRow[]` | オフセット配列から指定範囲の行をパース |
| `create_view` | `viewId, sourceViewId, filters[]` | `rowCount: u32` | フィルタ適用済みバイトオフセットを新 view として保存 |
| `delete_view` | `viewId` | `null` | AppState から view を削除（メモリ解放） |
| `get_source_row_index` | `derivedViewId, rowIndex, sourceViewId` | `u32` | 派生 view の行番号を上流 view の行番号に変換 |

**Rust の AppState 構造**:

```rust
AppState {
    dlt_files: Mutex<HashMap<String, DltFileState>>,
    // key = ファイルパス
    // value = { path: String, offsets: Vec<u64> }

    dlt_views: Mutex<HashMap<String, DltView>>,
    // key = UUID (create_view 呼び出し側が生成)
    // value = { file_id: String, offsets: Vec<u64> }
    // file_id は最終的な物理ファイルへのポインタ
    // offsets はフィルタ通過メッセージのバイトオフセット列
}
```

`DltView.offsets` は常に `DltFileState.offsets` の部分集合（ソートされたバイトオフセット）なので、`binary_search` が成立する。

---

## 4. ファイル構成

```
src/
├── types.ts                    # 全ノードの data 型 (SourceLogViewData, DerivedLogViewData,
│                               #   FilterNodeData, MarkingNodeData, MarkColor, MarkingRule)
├── bindings.ts                 # 自動生成。手編集禁止。
└── components/
    ├── Canvas.tsx              # ReactFlow 初期化 + ノード追加ボタン
    ├── condition/
    │   ├── FilterNode.tsx      # フィルタ条件 UI
    │   └── MarkingNode.tsx     # マーキングルール UI
    └── log-view/
        ├── useLogView.ts           # 仮想スクロール + 行キャッシュ + 選択の共通 Hook
        ├── LogViewDisplay.tsx      # 共通表示コンポーネント（ヘッダー・スクロール・フッター）
        ├── SourceLogViewNode.tsx   # ファイル起点ノード
        ├── DerivedLogViewNode.tsx  # 条件適用後ノード
        ├── useDerivedViewSync.ts   # 条件変化の自動検知・再適用 Hook
        └── markingUtils.ts         # computeMarks 純関数
```

---

## 5. 設計レビュー

### 5.1 問題: `isFirstRender` によるマウントスキップが脆弱

**現状**  
`useDerivedViewSync` は初回マウントをスキップするために `useRef(true)` を使っている。「Create Output →」でノードとエッジを同時に追加するとき、マウント直後の effect を無視することで二重処理を防いでいる。

```ts
if (isFirstRender.current) { isFirstRender.current = false; return; }
```

**問題点**
- React StrictMode では effect が 2 回実行されるため、2 回目のマウントで `isFirstRender` はすでに `false` になっており、意図しない再適用が走る
- 「Create Output →」で `addNodes + addEdges` を呼ぶとき、React 18 のバッチ更新でマウントと edge 追加が同一コミットに入ることを前提にしている。将来 Concurrent Mode の挙動が変わると壊れる可能性がある

**改善案**  
「Create Output →」が完了した直後は、DerivedLogViewNode の `data` がすでに正しい状態になっている。初回スキップの代わりに、`data` の snapshot と signature を比較して「何も変化していないなら何もしない」という冪等チェックに変える。

```ts
// signature が変わったが data.viewId が最新の create_view の結果と一致するなら skip
```

または: 「Create Output →」が呼ぶ side-effect 自体を `useDerivedViewSync` に委譲し、ボタンはあくまで「接続を作るだけ」にする設計にする。

---

### 5.2 問題: `useNodes()` がドラッグ中も毎フレーム再レンダリングを引き起こす

**現状**  
`useDerivedViewSync` が `useNodes()` を呼んでいるため、DerivedLogViewNode を含む全ての ReactFlow ノードを動かすたびに signature 再計算が走る。

```ts
const nodes = useNodes(); // 全ノード変化（位置含む）に反応
```

signature 文字列は位置を含まないため effect は発火しないが、**レンダリングは発生する**。DerivedLogViewNode が多ければ多いほど負荷は増える。

**改善案**  
`useStore` セレクターで「自分の incoming edge に接続されている condition ノードの data だけ」を購読する。FilterNode/MarkingNode ですでにこのパターンを使っている（`useStore` で rowCount を購読）。

```ts
const conditionDataSignature = useStore((s) => {
  const incoming = s.edges.filter((e) => e.target === id);
  return incoming.map((e) => {
    const n = s.nodes.find((node) => node.id === e.source);
    return n ? `${e.source}:${JSON.stringify(n.data)}` : e.source;
  }).sort().join("|");
});
```

これにより position 変化ではセレクター結果が変わらず、`useDerivedViewSync` はレンダリングされない。

---

### 5.3 問題: `sourceViewId` の命名が「直接の親」を指すのか「究極の起点」を指すのか不明瞭

**現状**  
`DerivedLogViewData.sourceViewId` は生成時に確定する「直接の上流 viewId」。複数段チェーン（Source → FilterA → DerivedA → MarkingB → DerivedB）の場合、DerivedB の `sourceViewId` は DerivedA の `viewId` であり、最終的なファイル ID ではない。

**問題点**  
- ダブルクリックジャンプは「直接の親」へのジャンプ（1 段）。最終ソースへ飛ぶには複数回ダブルクリックが必要
- `get_source_row_index` も「直接の親 view における行番号」を返す
- ドキュメントやコード内のコメントで「source」という言葉が「直接の親」と「ファイルの起点」の両義で使われている

**改善案**  
フィールド名を `parentViewId` に改名して「直接の親」であることを明示する。将来的に「ファイルまで遡る」機能が欲しくなったとき、`rootViewId` を別途追加する余地ができる。

---

### 5.4 問題: FilterNode が切断されても古い derived view が Rust に残る（メモリリーク）

**現状**  
`useDerivedViewSync` でフィルタノードが 0 個になったとき:

```ts
if (filterNodes.length === 0) {
  updateNodeData(id, { markingRules }); // ← viewId はそのまま
  return;
}
```

フィルタが全部切断されても `data.viewId` は古い UUID のままで、Rust 側の `DltView` は削除されない。

**問題点**  
- Rust の AppState にオフセット配列が積み上がり続ける
- 長時間使用すると数百万行 × 複数ビューでメモリを圧迫しうる

**改善案**  
フィルタノード 0 個のとき、`data.viewId !== data.sourceViewId` であれば `delete_view(data.viewId)` を呼び、`viewId` を `sourceViewId` に戻す。

```ts
if (filterNodes.length === 0) {
  if (data.viewId !== data.sourceViewId) {
    void commands.deleteView(data.viewId);
  }
  updateNodeData(id, { viewId: data.sourceViewId, rowCount: /* source rowCount */ , markingRules });
  return;
}
```

ただしこの際 source の rowCount を取得する方法が現状ない（`getNode(sourceNodeId).data.rowCount` で読める）。

---

### 5.5 問題: `jumpToRow`（1-based）と `scrollToIndex`（0-based）が混在

**現状**  
`useLogView` が 2 種類のスクロール関数を公開している:

```ts
jumpToRow(n)     // フッター UI 向け: 1-based, n-1 でスクロール
scrollToIndex(n) // 内部 API: 0-based, そのままスクロール
```

`jumpToRow` は「ユーザーが入力した行番号（1-based）」のための API で、`scrollToIndex` は「プログラム的な 0-based インデックス」向け。

**改善案**  
`LogViewDisplay` の内部にとどめ、フッターの行ジャンプは `jumpToRow` を使い続ける。外部（ノード間の jumpRequest）は `scrollToIndex` を使う。現状で役割分担は正しいが、名前の差が明確でないため `scrollToRow` と `scrollToIndex` などに統一すると混乱が減る。

---

### 5.6 問題: ファイルパスを viewId として使用する

**現状**  
`open_dlt_file` が返す `DltFileInfo.id` はファイルの絶対パスそのもの。

**問題点**  
同じファイルを 2 つの `SourceLogViewNode` で開くと viewId が重複し、2 つ目の open が最初の AppState エントリを上書きする。片方の行キャッシュが意図しない状態になりうる。

**改善案**  
`open_dlt_file` 内で UUID を生成し、それを `id` として返す。`DltFileState` にはパスを持たせ続けることで I/O は引き続き可能。

---

### 5.7 観察: FilterNode は outgoing edge が 1 本しか想定されていない

現状の「Create Output →」は `edges.find(e => e.source === id)` で最初の 1 本しか見ない。1 つの FilterNode から 2 つの DerivedLogViewNode を生成することは UI 上はできない。現状の設計でこれが問題になるケースはないが、将来「分岐フィルタ」を実装するときに要注意。

---

### まとめ: 優先度別の改善候補

| 優先度 | 問題 | 影響 |
|---|---|---|
| 高 | 5.4 FilterNode 切断時の derived view メモリリーク | 長時間使用で Rust メモリ増加 |
| 高 | 5.2 `useNodes()` による全ノード再レンダリング | ノード数が増えると操作時の体感が遅くなる |
| 中 | 5.1 `isFirstRender` の StrictMode 非対応 | 開発モードでの二重処理バグ |
| 中 | 5.6 ファイルパス = viewId の衝突 | 同一ファイルを複数ウィンドウで開くと破綻 |
| 低 | 5.3 `sourceViewId` の命名曖昧さ | 読みやすさの問題 |
| 低 | 5.5 `jumpToRow` / `scrollToIndex` の命名 | 読みやすさの問題 |
| 低 | 5.7 FilterNode の single outgoing edge 前提 | 現状は機能しているが将来的な拡張時に注意 |
