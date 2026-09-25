import { SectionTag } from "@/components/Brand";
import { FileCode, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { WingsSandbox } from "@/components/wings/WingsSandbox";
import { api } from "@/convex/_generated/api";
import { useEggsReady } from "@/hooks/use-eggs";
import { useWings } from "@/hooks/use-wings";
import { cn } from "@/lib/utils";

/**
 * Wings — the per-session agent.
 *
 * A Pterodactyl wings daemon is a small binary that owns one server: it takes
 * commands, keeps the process alive, streams the output back. The Baileys
 * equivalent is smaller, but it exists for the same reason — so an egg's
 * `index.js` is never the thing talking to WhatsApp. Wings is.
 *
 * This page is the reference: what the agent is, what the SDK bridge gives a
 * script, and a sandbox you can run a script in right now, with no phone
 * attached.
 */

/** The SDK surface the bridge hands an egg's script. */
const BRIDGE: { group: string; members: { name: string; note: string }[] }[] = [
  {
    group: "Socket",
    members: [
      { name: "makeWASocket()", note: "returns the simulated sock — ev, user, sendMessage" },
      { name: "sock.ev", note: "on / off / emit, same shape as the Baileys event bus" },
      { name: "sock.sendMessage(jid, content)", note: "echoes into the console as [sent]" },
      { name: "sock.groupMetadata(jid)", note: "group subject and participants" },
    ],
  },
  {
    group: "Module",
    members: [
      { name: "baileys.makeWASocket", note: "the same function, namespaced" },
      { name: "baileys.downloadMediaMessage", note: "returns an empty buffer" },
      { name: "baileys.generateWAMessageFromContent", note: "stamps a key, keeps the content" },
      { name: "baileys.isJidGroup / isJidUser", note: "real suffix checks" },
    ],
  },
  {
    group: "Runtime",
    members: [
      { name: "process.env", note: "the session's config, parsed as KEY=value" },
      { name: "sleep(ms)", note: "promise-based delay" },
      { name: "console", note: "captured line by line into the run output" },
    ],
  },
];

/** The lifecycle an egg walks, install to first message. */
const STAGES = [
  {
    n: "01",
    title: "The panel lays the files down",
    body: "Installing an egg writes every file it ships onto the session's disk — index.js, package.json, whatever else the manifest carries. Nothing runs yet.",
  },
  {
    n: "02",
    title: "Wings resolves a runtime",
    body: "The session's runtime (nodejs_22, bun, deno…) is checked against the egg's requirement. A mismatch fails the install rather than crashing at boot.",
  },
  {
    n: "03",
    title: "The install script runs",
    body: "npm install, bun install, deno cache — whatever the manifest declared. Progress streams to the console as one line at a time.",
  },
  {
    n: "04",
    title: "The entrypoint boots",
    body: "Wings executes the startup command in a context where `baileys` and `makeWASocket` are already bound. Your script never imports the SDK; it is handed a live socket.",
  },
];

export default function Wings() {
  const eggs = useQuery(api.eggs.listEggs, {});
  const runtimes = useQuery(api.eggs.listRuntimes, {});
  useEggsReady(eggs?.length, runtimes?.length);

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <SectionTag tone="ember">wings</SectionTag>
        <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
          The agent that holds the socket
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          An egg ships a script. Wings is what runs it — the layer that keeps a
          WhatsApp connection alive, hands your code a live{" "}
          <code className="font-mono text-xs text-neon">sock</code>, and streams
          every line it produces back to the console.
        </p>

        {/* ---- Lifecycle ---- */}
        <div className="rune-rule my-10" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          From install to first message
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {STAGES.map((stage) => (
            <motion.div
              key={stage.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="slab p-5"
            >
              <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-ember">
                {stage.n}
              </span>
              <h3 className="mt-2 font-display text-base font-bold">
                {stage.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {stage.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ---- The bridge ---- */}
        <div className="rune-rule my-10" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          What the bridge hands your script
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your egg never imports the SDK. It is already in scope when the
          entrypoint runs — which is why the same file works in the sandbox
          below and against a real phone through the runner.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {BRIDGE.map((group) => (
            <div key={group.group} className="slab p-5">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-neon">
                {group.group}
              </h3>
              <ul className="mt-3 space-y-3">
                {group.members.map((m) => (
                  <li key={m.name}>
                    <p className="font-mono text-[11px] text-foreground">
                      {m.name}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-mist">
                      {m.note}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---- The sandbox ---- */}
        <div className="rune-rule my-10" />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          Try the bridge
        </h2>
        <p className="mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This runs in the panel&apos;s sandbox with the full bridge in scope. No
          phone, no account, no side effects — a script that works here works
          against a real socket through the runner.
        </p>
        <WingsSandbox />

        {/* ---- The runner ---- */}
        <div className="rune-rule my-10" />
        <RunnerDownload />

        <div className="mt-8 rounded-xl border border-ember/30 bg-ember/[0.06] p-5">
          <h3 className="font-display text-sm font-bold text-ember">
            The sandbox is a playground, not a jail
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            It runs in <code className="font-mono text-xs">node:vm</code> with no{" "}
            <code className="font-mono text-xs">process</code>, no{" "}
            <code className="font-mono text-xs">require</code> and no network.
            Perfect for writing and testing an agent. If you need to run code you
            did not write, run the daemon yourself.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** The downloadable daemon. */
function RunnerDownload() {
  const { runnerSource } = useWings(undefined);
  const [preview, setPreview] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const out = await runnerSource({});
      setPreview(out.source);
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!preview) return;
    const blob = new Blob([preview], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wings-runner.mjs";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="slab p-6">
        <SectionTag tone="neon">the daemon</SectionTag>
        <h2 className="mt-4 font-display text-lg font-bold">
          wings-runner.mjs
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          One file, one dependency, real Baileys. It reads the same directory
          the file manager produced — <code className="font-mono text-xs">index.js</code>{" "}
          as the entrypoint, <code className="font-mono text-xs">creds.json</code> for
          the linked device — opens the genuine socket and boots your script with
          the real library bound to the same names the bridge uses.
        </p>

        <div className="mt-4 space-y-1.5 font-mono text-[11px] text-mist">
          {[
            "npm install @whiskeysockets/baileys",
            "BAILEYS_DIR=./sandbox node wings-runner.mjs",
          ].map((line) => (
            <p key={line} className="well px-3 py-1.5">
              <span className="text-neon">$</span> {line}
            </p>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading} variant="outline">
            <FileCode className="size-4" />
            {loading ? "Fetching…" : "Read the source"}
          </Button>
          <Button onClick={save} disabled={!preview}>
            <Terminal className="size-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="slab flex flex-col overflow-hidden">
        <div className="border-b border-border/70 px-4 py-2.5">
          <p className="font-mono text-[11px] text-mist">
            {preview ? "wings-runner.mjs" : "source not loaded"}
          </p>
        </div>
        <pre
          className={cn(
            "well m-3 flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed",
            !preview && "flex items-center justify-center",
          )}
        >
          {preview ?? (
            <span className="text-mist">Read the source to see the daemon.</span>
          )}
        </pre>
      </div>
    </div>
  );
}
