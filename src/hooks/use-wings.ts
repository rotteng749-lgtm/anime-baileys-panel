import { api } from "@/convex/_generated/api";
import type { SessionId } from "@/hooks/use-panel";
import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";

/**
 * Drive a wings run.
 *
 * The panel owns the script's bytes — they live on the session's disk — and the
 * action owns the evaluation, because `node:vm` is not available in the Convex
 * runtime. So a run hands the entrypoint to the sandbox with the session's
 * environment, then writes the outcome back to the console.
 */
export type RunResult = {
  ok: boolean;
  exitCode: number;
  output: string[];
  durationMs: number;
  truncated: boolean;
};

export function useWings(sessionId: SessionId | undefined) {
  const runScript = useAction(api.wings.runScript);
  const runnerSource = useAction(api.wings.runnerSource);
  const appendLog = useMutation(api.sessions.appendLog);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | undefined>();

  const run = useCallback(
    async (args: {
      path: string;
      source: string;
      env?: string[];
      status?: string;
      files?: { path: string; contents: string }[];
    }) => {
      setRunning(true);
      try {
        const out = await runScript({
          source: args.source,
          filename: args.path,
          env: args.env ?? [],
          status: args.status ?? "disconnected",
          files: args.files,
        });
        setResult(out);
        if (sessionId) {
          await appendLog({
            sessionId,
            level: out.ok ? "success" : "error",
            message: `[wings] ${args.path} → exit ${out.exitCode} in ${out.durationMs}ms`,
          });
        }
        return out;
      } finally {
        setRunning(false);
      }
    },
    [runScript, appendLog, sessionId],
  );

  const clear = useCallback(() => setResult(undefined), []);

  return { run, running, result, clear, runnerSource };
}
