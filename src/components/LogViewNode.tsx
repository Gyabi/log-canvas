import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, type DltFileInfo, type DltRow } from "../bindings";

const FETCH_SIZE = 100;

export default function LogViewNode() {
  const [fileInfo, setFileInfo] = useState<DltFileInfo | null>(null);
  const [, setCacheVersion] = useState(0);
  const rowCache = useRef(new Map<number, DltRow>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: fileInfo?.rowCount ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 15,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const rangeStart = virtualItems[0]?.index ?? -1;
  const rangeEnd = virtualItems[virtualItems.length - 1]?.index ?? -1;

  useEffect(() => {
    if (!fileInfo || rangeStart === -1 || fetchingRef.current) return;

    const missing: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (!rowCache.current.has(i)) missing.push(i);
    }
    if (missing.length === 0) return;

    let cancelled = false;
    fetchingRef.current = true;

    commands.getLogRows(fileInfo.id, missing[0], FETCH_SIZE).then((result) => {
      fetchingRef.current = false;
      if (cancelled) return;
      if (result.status === "ok") {
        for (const row of result.data) {
          rowCache.current.set(row.index, row);
        }
        setCacheVersion((v) => v + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fileInfo, rangeStart, rangeEnd]);

  async function handleOpenFile() {
    const path = await open({
      filters: [{ name: "DLT", extensions: ["dlt"] }],
    });
    if (!path) return;

    const result = await commands.openDltFile(path);
    if (result.status === "ok") {
      rowCache.current.clear();
      setFileInfo(result.data);
    }
  }

  const fileName = fileInfo
    ? (fileInfo.path.split("/").pop() ?? fileInfo.path)
    : "file is not selected";

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-neutral-600 bg-neutral-900 shadow-lg"
      style={{ width: "100%", height: "100%" }}
    >
      {/* Header */}
      <div className="nodrag shrink-0 flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2">
        <span className="flex-1 truncate text-xs font-semibold text-neutral-300">
          {fileName}
        </span>
        <button
          onClick={handleOpenFile}
          className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 active:bg-blue-700"
        >
          open
        </button>
      </div>

      {/* Column headers */}
      <div className="nodrag shrink-0 flex items-center border-b border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-500 select-none">
        <span className="w-10 shrink-0">#</span>
        <span className="w-28 shrink-0">Timestamp</span>
        <span className="w-12 shrink-0">ECU</span>
        <span className="w-12 shrink-0">App</span>
        <span className="w-12 shrink-0">Ctx</span>
        <span className="w-16 shrink-0">Level</span>
        <span className="flex-1">Message</span>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="nodrag nowheel flex-1 overflow-y-auto">
        {fileInfo ? (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualItems.map((item) => {
              const row = rowCache.current.get(item.index);
              return (
                <div
                  key={item.key}
                  style={{
                    position: "absolute",
                    top: item.start,
                    left: 0,
                    right: 0,
                    height: item.size,
                  }}
                  className="flex items-center border-b border-neutral-800 px-2 font-mono text-xs hover:bg-neutral-800"
                >
                  {row ? (
                    <>
                      <span className="w-10 shrink-0 text-neutral-500">
                        {row.index}
                      </span>
                      <span className="w-28 shrink-0 text-neutral-400">
                        {formatTs(row.timestampUs)}
                      </span>
                      <span className="w-12 shrink-0 text-sky-400">
                        {row.ecuId}
                      </span>
                      <span className="w-12 shrink-0 text-emerald-400">
                        {row.appId}
                      </span>
                      <span className="w-12 shrink-0 text-amber-400">
                        {row.ctxId}
                      </span>
                      <span
                        className={`w-16 shrink-0 font-semibold ${levelClass(row.level)}`}
                      >
                        {row.level}
                      </span>
                      <span className="flex-1 truncate text-neutral-200">
                        {row.payload}
                      </span>
                    </>
                  ) : (
                    <span className="italic text-neutral-600">…</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            please open DLT file
          </div>
        )}
      </div>

      {/* Footer */}
      {fileInfo && (
        <div className="nodrag shrink-0 border-t border-neutral-700 bg-neutral-800 px-3 py-1 text-right text-xs text-neutral-500">
          {fileInfo.rowCount.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}

function formatTs(us: number | null): string {
  if (us == null) return "—";
  const totalSec = Math.floor(us / 1_000_000);
  const ms = Math.floor((us % 1_000_000) / 1000);
  const h = Math.floor(totalSec / 3_600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSec % 3_600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}.${ms.toString().padStart(3, "0")}`;
}

function levelClass(level: string): string {
  switch (level) {
    case "FATAL":
      return "text-red-500";
    case "ERROR":
      return "text-red-400";
    case "WARN":
      return "text-amber-400";
    case "INFO":
      return "text-green-400";
    case "DEBUG":
      return "text-sky-400";
    case "VERBOSE":
      return "text-neutral-400";
    default:
      return "text-neutral-400";
  }
}
