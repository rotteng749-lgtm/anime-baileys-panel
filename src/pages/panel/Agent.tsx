import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNodes, useSessions, useWorkers } from "@/hooks/use-panel";
import { DEFAULT_NODE_TOKEN, wingsPanelUrl } from "@/lib/demo";
import { cn } from "@/lib/utils";
import {
  Bot,
  Check,
  Copy,
  Download,
  Loader2,
  PlugZap,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Agent setup.
 *
 * The one thing the panel cannot do for you: hold the socket. Convex cannot
 * keep a websocket alive for weeks, so a small Node process on your machine
 * does — this page is the whole handshake, with the real deployment URL and a
 * copy button, so "no agent is holding this node" is a two-minute fix rather
 * than a mystery.
 */
export default function AgentSetup() {
  const workers = useWorkers();
  const nodes = useNodes();
  const sessions = useSessions();

  // Derived, not synced: the demo token is offered only while the node's stored
  // hash still belongs to it. The moment a token is rotated this falls back to
  // "paste your own", which is the truth.
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const node = (nodes ?? [])[0];
  const demoPrefix = DEFAULT_NODE_TOKEN.slice(0, 12);
  const demoTokenWorks = node?.tokenPrefix === demoPrefix;
  const token = tokenOverride ?? (demoTokenWorks ? DEFAULT_NODE_TOKEN : "");

  const panel = wingsPanelUrl();
  const live = (workers ?? []).filter((worker) => worker.online);
  const queued = (sessions ?? []).filter(
    (session) => session.desiredPower !== session.power,
  );

  const runCommand = `NODE_TOKEN=${token || "<the node's wings token>"} KAIZEN_PANEL=${panel} node wings-agent.mjs`;
  const checkCommand = `${runCommand} --check`;

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => toast.success(label));
  };

  return (
    <div>
      <PageHead
        eyebrow="Runtime"
        title="Agent"
        description="The socket lives on a machine you run, not in the panel. Start the agent once and every server on that node becomes controllable — power, QR, sends and installs all go through it."
      />

      {/* ---- Live status ---- */}
      {live.length > 0 ? (
        <div className="slab border-emerald-400/30 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_oklch(0.8_0.16_150/80%)]" />
            <h2 className="font-display text-sm font-bold text-emerald-200">
              Agent online
            </h2>
            <span className="font-mono text-[11px] text-mist">
              heartbeat every 5s
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {live.map((worker) => (
              <div key={worker._id} className="well p-4 font-mono text-[11px]">
                <p className="font-display text-sm font-bold text-foreground">
                  {worker.name}
                </p>
                <p className="mt-1 text-mist">
                  node {worker.nodeSlug ?? "?"} · v{worker.version}
                  {worker.pid ? ` · pid ${worker.pid}` : ""}
                </p>
                <p className="mt-1 text-emerald-300">
                  {worker.sessions} socket(s) held
                </p>
                <p className="mt-1 text-mist">
                  seen{" "}
                  {new Date(worker.lastSeenAt).toLocaleTimeString([], {
                    hour12: false,
                  })}
                </p>
              </div>
            ))}
          </div>
          {queued.length > 0 && (
            <p className="mt-4 text-xs text-amber-200">
              {queued.length} server(s) have a command waiting — the agent claims
              them on its next poll, within a couple of seconds.
            </p>
          )}
        </div>
      ) : (
        <div className="slab border-amber-400/30 p-5">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-amber-300" />
            <h2 className="font-display text-sm font-bold text-amber-200">
              No agent attached
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Until an agent reports in, the panel queues every command and says
            so. That is why a console log can read{" "}
            <span className="font-mono text-[11px] text-amber-200">
              no agent is holding Jakarta 01
            </span>{" "}
            over and over: nothing on the node can open a socket yet. Run the
            command below on that machine and those same queued commands run for
            real.
          </p>
          {queued.length > 0 && (
            <p className="mt-3 font-mono text-[11px] text-mist">
              {queued.length} command(s) already queued — they stay queued, so
              nothing is lost while you set this up.
            </p>
          )}
        </div>
      )}

      {/* ---- The command ---- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="slab p-5 lg:col-span-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            1 · install the runtime
          </h3>
          <pre className="well mt-3 overflow-x-auto p-4 font-mono text-[11px] text-sky-200">
            npm install @whiskeysockets/baileys
          </pre>

          <h3 className="mt-6 font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            2 · run the agent on the node
          </h3>
          <pre className="well mt-3 overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-sky-200">
            {runCommand}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(runCommand, "Command copied")}>
              <Copy className="size-3" />
              Copy command
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/wings-agent.mjs" download>
                <Download className="size-3" />
                Download wings-agent.mjs
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copy(checkCommand, "Check command copied")}
              title="Authenticates and exits — proves the token without a WhatsApp account"
            >
              <ShieldCheck className="size-3" />
              Copy the --check variant
            </Button>
          </div>

          <h3 className="mt-6 font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            3 · order a socket
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Back in the{" "}
            <Link className="text-neon hover:text-holo" to="/dashboard/console">
              console
            </Link>
            , press <span className="font-semibold text-foreground">Start</span>{" "}
            — or just wait: the queued start is claimed within a couple of
            seconds of the agent's first heartbeat. The QR, the pairing code and
            the console lines after that all come off the real socket.
          </p>
        </div>

        {/* ---- Token + node ---- */}
        <div className="space-y-4">
          <div className="slab p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
              Node token
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The agent authenticates with the wings token of the node it runs
              on — nothing else. A node only ever reaches its own servers.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="node-token" className="text-xs">
                Token in the command
              </Label>
              <Input
                id="node-token"
                value={token}
                onChange={(e) => setTokenOverride(e.target.value)}
                placeholder="wings_…"
                className="font-mono text-xs"
              />
            </div>
            <p
              className={cn(
                "mt-3 font-mono text-[10px] leading-relaxed",
                demoTokenWorks ? "text-emerald-300" : "text-amber-200",
              )}
            >
              {!node
                ? "no node exists yet — seed the infrastructure from the admin area"
                : demoTokenWorks
                  ? `this node still uses the seeded demo token (${demoPrefix}…)`
                  : `this node's token prefix is ${node.tokenPrefix}… — paste the full token, or reset it in the admin area`}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              asChild
            >
              <Link to="/admin/infrastructure">
                <PlugZap className="size-3" />
                Node tokens in Admin
              </Link>
            </Button>
          </div>

          <div className="slab p-5">
            <h3 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
              <Terminal className="size-3.5" />
              What it does
            </h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              {[
                "one real Baileys socket per server, in one process",
                "heartbeats every 5s — that is what makes a node 'online'",
                "claims power, send, pairing, logout and install commands",
                "saves creds on disk and in the server volume, so restarts stay linked",
                "runs an egg's install script and boots its startup line",
                "reports every event, which is what drives the webhooks",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-300" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {workers === undefined && (
              <p className="mt-3 flex items-center gap-2 text-[11px] text-mist">
                <Loader2 className="size-3 animate-spin" />
                checking for agents…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
