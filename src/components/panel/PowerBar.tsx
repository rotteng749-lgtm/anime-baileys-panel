import { Button } from "@/components/ui/button";
import {
  Loader2,
  Play,
  Power,
  RotateCcw,
  Square,
  Zap,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { PowerAction, SessionId } from "@/hooks/use-panel";
import { cn } from "@/lib/utils";

/**
 * The four verbs.
 *
 * A hosting panel sends `start`, `stop`, `restart` or `kill` and the node
 * translates each into whatever stops the agent. Here that is the socket:
 * start brings it up and walks the pairing handshake, stop closes it cleanly
 * and keeps the creds, kill drops it without a flush.
 */
const VERBS: {
  action: PowerAction;
  label: string;
  icon: typeof Play;
  tone: string;
}[] = [
  { action: "start", label: "Start", icon: Play, tone: "text-emerald-300" },
  { action: "stop", label: "Stop", icon: Square, tone: "text-amber-300" },
  { action: "restart", label: "Restart", icon: RotateCcw, tone: "text-neon" },
  { action: "kill", label: "Kill", icon: Zap, tone: "text-rose-300" },
];

export function PowerBar({
  sessionId,
  power,
  disabled,
  size = "sm",
}: {
  sessionId: SessionId;
  power?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  const send = useMutation(api.sessions.powerAction);
  const [busy, setBusy] = useState<PowerAction | undefined>();

  const run = async (action: PowerAction) => {
    if (action === "kill") {
      if (!window.confirm("Kill the socket? No flush, no goodbye.")) return;
    }
    setBusy(action);
    try {
      await send({ sessionId, action });
      toast.success(`${action} sent to wings`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(undefined);
    }
  };

  const running = power === "running";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {VERBS.map((verb) => {
        const Icon = busy === verb.action ? Loader2 : verb.icon;
        return (
          <Button
            key={verb.action}
            size={size}
            variant={verb.action === "start" ? "default" : "outline"}
            disabled={disabled || busy !== undefined}
            onClick={() => run(verb.action)}
            className={cn(verb.tone)}
            title={
              verb.action === "kill"
                ? "SIGKILL — drop the socket now"
                : `Power ${verb.action.toLowerCase()}`
            }
          >
            <Icon className={cn("size-3.5", busy === verb.action && "animate-spin")} />
            {verb.label}
          </Button>
        );
      })}
      <span
        className={cn(
          "ml-1 font-mono text-[10px] uppercase tracking-widest",
          running ? "text-emerald-300" : "text-mist",
        )}
      >
        {running ? "running" : "stopped"}
      </span>
    </div>
  );
}

/** A single icon button, for a row in a list. */
export function PowerButton({
  sessionId,
  power,
  icon: Icon = Power,
  label = "Power",
}: {
  sessionId: SessionId;
  power?: string;
  icon?: typeof Power;
  label?: string;
}) {
  const send = useMutation(api.sessions.powerAction);
  const [busy, setBusy] = useState(false);
  const running = power === "running";

  return (
    <Button
      size="sm"
      variant="ghost"
      title={running ? "Stop" : "Start"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await send({ sessionId, action: running ? "stop" : "start" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "That did not work");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Icon className={cn("size-3.5", running ? "text-emerald-300" : "text-mist")} />
      )}
      {label}
    </Button>
  );
}
