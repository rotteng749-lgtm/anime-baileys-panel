import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronRight, FileCode, FileJson, FileText, Folder } from "lucide-react";

/**
 * A read-only file viewer for the files an egg ships.
 *
 * Paths are listed as a flat tree, which is how an egg is actually stored —
 * a manifest plus a handful of files — and avoids pretending there is more
 * structure than there is.
 */

function iconFor(path: string) {
  if (path.endsWith(".json")) return FileJson;
  if (/\.(js|mjs|cjs|ts)$/.test(path)) return FileCode;
  if (path.endsWith(".md")) return FileText;
  return FileText;
}

export function FileTree({
  files,
  className,
  initialPath,
}: {
  files: Array<{ path: string; contents: string }>;
  className?: string;
  initialPath?: string;
}) {
  const [openPath, setOpenPath] = useState(initialPath ?? files[0]?.path);
  const active = files.find((f) => f.path === openPath) ?? files[0];

  if (files.length === 0) {
    return (
      <p className={cn("text-sm text-mist", className)}>
        This egg ships no files — the install writes everything it needs.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-[200px_1fr]", className)}>
      <div className="well max-h-80 overflow-y-auto p-2">
        {files.map((file) => {
          const Icon = iconFor(file.path);
          const selected = file.path === active?.path;
          return (
            <button
              key={file.path}
              type="button"
              onClick={() => setOpenPath(file.path)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-[11px] transition-colors",
                selected
                  ? "bg-neon/12 text-neon"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3 shrink-0 transition-transform",
                  selected && "rotate-90",
                )}
              />
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{file.path}</span>
            </button>
          );
        })}
      </div>

      <div className="well max-h-80 overflow-auto p-4">
        {active && (
          <>
            <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-mist">
              <Folder className="size-3" />
              {active.path}
              <span className="ml-auto">
                {new Blob([active.contents]).size} B
              </span>
            </p>
            <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              <code>{active.contents}</code>
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
