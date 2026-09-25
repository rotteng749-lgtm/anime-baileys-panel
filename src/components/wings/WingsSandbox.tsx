import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { CheckCircle2, Loader2, Play, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useWings } from "@/hooks/use-wings";
import type { SessionId } from "@/hooks/use-panel";
import { cn } from "@/lib/utils";

/** A starter agent, runnable as-is. */
export const WINGS_STARTER = `// Anything in here runs against the wings bridge.
const sock = makeWASocket();

console.log("session status:", baileys.sessionStatus);

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  const text = msg?.message?.conversation ?? "";
  if (text === "!ping") {
    await sock.sendMessage(msg.key.remoteJid, { text: "pong" });
  }
  console.log("saw:", text.slice(0, 48));
});

await sock.sendMessage("6281234567890@s.whatsapp.net", { text: "wings online" });
console.log("listeners armed:", sock.ev.listenerCount("messages.upsert"));
`;

/**
 * The wings sandbox.
 *
 * Type a script, run it, read what it printed. The bridge in scope here is the
 * same shape the runner binds to a real socket, so an agent that works in the
 * box works on a phone.
 */
export function WingsSandbox({
  sessionId,
  initialSource,
  files,
  filename = "index.js",
}: {
  /** When given, the run is recorded in that session's console. */
  sessionId?: SessionId;
  initialSource?: string;
  /** The session's own text files, so `require("./queue.json")` resolves. */
  files?: { path: string; contents: string }[];
  filename?: string;
}) {
  const { run, running, result, clear } = useWings(sessionId);
  const [source, setSource] = useState(initialSource ?? WINGS_STARTER);

  const onRun = async () => {
    try {
      const out = await run({ path: filename, source, files });
      if (out.ok) toast.success(`exit 0 in ${out.durationMs}ms`);
      else toast.error(`exited ${out.exitCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    }
  };

  return (
    <div className="slab overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-rose-400/80" />
          <span className="size-2 rounded-full bg-amber-300/80" />
          <span className="size-2 rounded-full bg-emerald-400/80" />
        </div>
        <span className="font-mono text-[11px] text-mist">wings — {filename}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSource(WINGS_STARTER)}
            title="Reset to the starter agent"
          >
            <RotateCcw className="size-3" />
          </Button>
          <Button size="sm" onClick={onRun} disabled={running}>
            {running ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Run
          </Button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          aria-label="Script source"
          className="well m-3 min-h-[300px] resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-relaxed outline-none"
        />

        <div className="border-t border-border/70 p-3 lg:border-t-0 lg:border-l">
          <div className="mb-2 flex items-center gap-2 px-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mist">
              output
            </p>
            {result && (
              <span
                className={cn(
                  "ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]",
                  result.ok
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                    : "border-rose-400/40 bg-rose-400/10 text-rose-300",
                )}
              >
                {result.ok ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <XCircle className="size-3" />
                )}
                exit {result.exitCode} · {result.durationMs}ms
              </span>
            )}
          </div>
          <div className="well h-[300px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed">
            {result ? (
              result.output.length > 0 ? (
                result.output.map((line, i) => (
                  <p
                    key={i}
                    className={cn(
                      "break-all whitespace-pre-wrap",
                      line.startsWith("error:")
                        ? "text-rose-300"
                        : line.startsWith("warn:")
                          ? "text-amber-300"
                          : line.startsWith("[sent]")
                            ? "text-neon"
                            : "text-sky-200",
                    )}
                  >
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-mist">Ran clean, printed nothing.</p>
              )
            ) : (
              <p className="text-mist">Press Run to execute the script.</p>
            )}
          </div>
          {result && (
            <button
              type="button"
              onClick={clear}
              className="mt-2 px-1 text-[11px] text-mist transition-colors hover:text-foreground"
            >
              Clear output
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The panel-side variant: pick a file off the session's disk and load it into
 * the sandbox, so an egg's entrypoint can be run without the phone.
 */
export function SessionSandbox({ sessionId }: { sessionId: SessionId }) {
  const files = useQuery(api.files.allFiles, { sessionId });
  const [path, setPath] = useState<string | undefined>();
  const [loaded, setLoaded] = useState<string | undefined>();

  const scripts = (files ?? []).filter(
    (f) => /\.(js|mjs|cjs)$/.test(f.path) && !f.isDir,
  );
  const chosen = path ?? scripts[0]?.path;

  const entry = useQuery(
    api.files.readFile,
    chosen ? { sessionId, path: chosen } : "skip",
  );

  return (
    <div className="space-y-4">
      <div className="slab flex flex-wrap items-center gap-3 p-4">
        <div className="relative">
          <select
            value={chosen ?? ""}
            onChange={(e) => {
              setPath(e.target.value);
              setLoaded(undefined);
            }}
            className="h-10 appearance-none rounded-lg border border-edge bg-gradient-to-b from-surface-3 to-surface pr-9 pl-3.5 text-sm font-semibold outline-none"
          >
            {scripts.length === 0 && <option className="bg-surface">no scripts on disk</option>}
            {scripts.map((f) => (
              <option key={f.path} value={f.path} className="bg-surface">
                {f.path}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          disabled={!entry}
          onClick={() => entry && setLoaded(entry.contents)}
        >
          Load into sandbox
        </Button>
        {scripts.length === 0 && (
          <p className="text-xs text-mist">
            Install an egg, or upload a script in the file manager, to get an
            entrypoint.
          </p>
        )}
      </div>

      {/* Remounting on a new source is how the editor picks up a loaded file. */}
      <WingsSandbox
        key={loaded ?? chosen ?? "starter"}
        sessionId={sessionId}
        filename={chosen ?? "index.js"}
        files={(files ?? []).map((f) => ({ path: f.path, contents: f.contents }))}
        initialSource={loaded ?? entry?.contents ?? WINGS_STARTER}
      />
    </div>
  );
}
