# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language
use Japanease in chat, but use English in code blocks and comments.

## Commands

```bash
# Development (hot-reload frontend + Rust backend)
bun run tauri dev

# Production build (output: src-tauri/target/release/bundle/)
bun run tauri build

# Type-check frontend
bun run build

# Lint TypeScript
bun run lint
bun run lint:fix

# Lint Rust (clippy with all/pedantic/nursery warnings as errors)
bun run lint:rs
bun run lint:rs:fix

# Regenerate TypeScript bindings from Rust commands
bun run gen-bindings
```

## Architecture

This is a **Tauri 2** desktop app with a **React 19 + TypeScript** frontend and **Rust** backend.

### IPC / Type Safety

Rust commands are annotated with `#[specta::specta]` and `#[tauri::command]`. The `tauri-specta` crate auto-generates [src/bindings.ts](src/bindings.ts) so the frontend calls Rust through strongly-typed wrappers in `commands.*` rather than raw `invoke()`.

- Add new Rust commands in [src-tauri/src/lib.rs](src-tauri/src/lib.rs) with both attributes, then register them in `collect_commands![]` inside `create_builder()`.
- In debug builds, bindings are regenerated automatically on startup. In CI or to regenerate manually, run `bun run gen-bindings` (executes `src-tauri/src/bin/codegen.rs`).
- Never edit [src/bindings.ts](src/bindings.ts) by hand — it is fully generated.

### Frontend (`src/`)

- Entry: [src/main.tsx](src/main.tsx) → [src/App.tsx](src/App.tsx)
- Currently a scaffold. Planned stack: React Flow (infinite canvas), Tailwind CSS.

### Rust backend (`src-tauri/src/`)

- `main.rs` — thin entry point, calls `lib::run()`.
- `lib.rs` — all commands and the Tauri builder live here. Exports `run()` and `export_bindings()`.
- `bin/codegen.rs` — standalone binary that calls `export_bindings()` to regenerate `src/bindings.ts`.
- Clippy lints are set to `all + pedantic + nursery` (warn level); `unsafe_code` is forbidden.

### Product Vision

The app is an **infinite whiteboard for log analysis** (primary target: DLT logs). Key planned features:
- Log files open as resizable cards on the canvas (React Flow nodes).
- Sticky-note comments can be anchored to individual log lines; the line height adjusts to the comment height.
- Column-level filtering/highlighting within log views.
- Project save/restore (canvas state: positions, sizes, filters, comment anchors).
