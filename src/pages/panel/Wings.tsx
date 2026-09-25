import { PageHead } from "@/components/panel/Shell";
import { EmptyState } from "@/components/panel/Parts";
import { StatusPill } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { Cpu, Play } from "lucide-react";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { useSessions } from "@/hooks/use-panel";
import { SessionSandbox } from "@/components/wings/WingsSandbox";

/**
 * Wings, from inside the panel.
 *
 * The public page explains the agent; this one runs it. Pick a session, load a
 * script off that session's disk and watch it execute against the bridge — no
 * phone required, which is the whole point when you are writing an egg at two in
 * the morning.
 */
export default function WingsPanel() {
  const sessions = useSessions();
  const [params, setParams] = useSearchParams();
  const requested = params.get("session") ?? undefined;
  const active = (sessions ?? []).find((s) => s._id === requested) ?? (sessions ?? [])[0];

  const installs = useQuery(
    api.eggs.listInstalls,
    active ? { sessionId: active._id } : "skip",
  );

  if ((sessions ?? []).length === 0) {
    return (
      <div>
        <PageHead
          eyebrow="Agent"
          title="Wings"
          description="Run an agent's script against the Baileys bridge before it ever touches a phone."
        />
        <EmptyState
          icon={Play}
          title="No session to run on"
          description="Wings boots a script inside a session. Create one first, then come back and run the entrypoint."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        eyebrow="Agent"
        title="Wings"
        description="Run an agent's script against the Baileys bridge before it ever touches a phone."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={active?._id ?? ""}
              onChange={(e) => setParams({ session: e.target.value })}
              className="h-10 rounded-lg border border-edge bg-gradient-to-b from-surface-3 to-surface px-3 text-sm font-semibold outline-none"
            >
              {(sessions ?? []).map((s) => (
                <option key={s._id} value={s._id} className="bg-surface">
                  {s.name}
                </option>
              ))}
            </select>
            {active && <StatusPill status={active.status} />}
          </div>
        }
      />

      {active && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {(installs ?? []).slice(0, 4).map((i) => (
              <span
                key={i._id}
                className="stat-chip flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] text-mist"
              >
                <Cpu className="size-3 text-neon" />
                {i.eggName}
                <span
                  className={
                    i.status === "installed" ? "text-emerald-300" : "text-amber-300"
                  }
                >
                  {i.status}
                </span>
              </span>
            ))}
            {(installs ?? []).length === 0 && (
              <p className="text-xs text-mist">
                Nothing installed on this session yet.{" "}
                <Link to="/eggs" className="font-semibold text-neon">
                  Browse the eggs →
                </Link>
              </p>
            )}
            <Button variant="outline" size="sm" asChild className="ml-auto">
              <Link to={`/dashboard/files?session=${active._id}`}>File manager</Link>
            </Button>
          </div>

          <SessionSandbox sessionId={active._id} />
        </>
      )}
    </div>
  );
}
