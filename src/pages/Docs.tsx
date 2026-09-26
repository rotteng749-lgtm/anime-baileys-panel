import { SectionTag } from "@/components/Brand";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  Cable,
  Cpu,
  FileCode,
  FolderTree,
  KeyRound,
  Layers,
  Radio,
  Search,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useEggsReady } from "@/hooks/use-eggs";
import { cn } from "@/lib/utils";

/**
 * The documentation.
 *
 * One page, six sections, in the order you actually meet them: make a session,
 * pair it, install an egg, write a script, wire an event out. Everything here
 * describes something the panel really does — the numbers, the limits and the
 * event names are the ones in the code.
 */

type Block =
  | { kind: "p"; text: string }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "note"; tone: "ember" | "neon"; text: string };

type Section = {
  id: string;
  label: string;
  icon: typeof Cable;
  blurb: string;
  body: Block[];
};

export default function Docs() {
  const eggs = useQuery(api.eggs.listEggs, {});
  const runtimes = useQuery(api.eggs.listRuntimes, {});
  useEggsReady(eggs?.length, runtimes?.length);

  const sections: Section[] = [
    {
      id: "concepts",
      label: "The concepts",
      icon: Layers,
      blurb: "Nest, egg, node, allocation — and why each one exists.",
      body: [
        {
          kind: "p",
          text: "The panel is two halves, and so is this one. The panel is what you look at: accounts, servers, files, console. Wings is the agent that runs on a machine and actually holds the socket. Everything below is one of the five ideas that split between them.",
        },
        {
          kind: "table",
          head: ["Concept", "What it is"],
          rows: [
            ["Nest", "The big category: WhatsApp bots, commerce, community, developer, media. The first thing you pick."],
            ["Egg", "A template inside a nest — an image, a startup command, env vars, an install script and the files it ships."],
            ["Node", "One machine running wings. It has a token, a location and a total of CPU, memory and disk."],
            ["Allocation", "A reserved ip:port on a node. One server takes one; the rest of the range stays free."],
            ["Server", "The row that ties them together: uuid, owner, node, allocation, nest, egg and its limits."],
          ],
        },
        {
          kind: "p",
          text: "The order you meet them in: pick a nest, pick an egg off the shelf, pick a node with room, claim an allocation on it, give the server its limits. The panel writes the row and queues the command; the agent on that node claims it on its next poll and does the work.",
        },
        {
          kind: "code",
          lang: "bash",
          lines: [
            "# what a node does, in the panel's own words",
            "curl -X POST https://your-panel/api/servers \\",
            '  -H "Authorization: Bearer <wings token>" \\',
            '  -d \'{"name":"bot-1","owner_id":"…","limits":{"memory":512,"disk":2048,"cpu":500}}\'',
          ],
        },
      ],
    },
    {
      id: "servers",
      label: "Servers",
      icon: Cable,
      blurb: "A server is one linked number, its uuid, its allocation and its limits.",
      body: [
        {
          kind: "p",
          text: "Everything in the panel hangs off a server. Create one, and it claims a free ip:port on a node, gets a uuid, and picks up default limits. From then on it owns the WhatsApp connection, the files on its disk and the console you watch.",
        },
        {
          kind: "table",
          head: ["Field", "Meaning"],
          rows: [
            ["uuid / uuid_short", "The stable id wings addresses the volume by. The short form is what the panel shows."],
            ["node / allocation", "Which machine it runs on, and which ip:port it answers on."],
            ["memory, disk, cpu, io", "Limits, in MB and millicores. What the meters are read against."],
            ["startup, image", "The command wings runs, and the runtime image it runs against."],
            ["power", "running or stopped. The four verbs below change it."],
          ],
        },
        {
          kind: "table",
          head: ["Status", "What it means"],
          rows: [
            ["disconnected", "No socket. Safe to install an egg or edit files."],
            ["connecting", "A handshake is in flight."],
            ["awaiting_pairing", "The QR or pairing code is on screen, waiting for your phone."],
            ["connected", "Linked and streaming. Install is locked while it is up."],
            ["conflict", "The same device is linked in two places. Unlink one."],
          ],
        },
        {
          kind: "note",
          tone: "neon",
          text: "Pairing takes one of two routes. QR is the default: the panel renders the matrix and your phone scans it. The eight-digit code is the fallback for a device that will not scan.",
        },
      ],
    },
    {
      id: "power",
      label: "Power",
      icon: Zap,
      blurb: "Four verbs, the way a hosting panel sends them.",
      body: [
        {
          kind: "p",
          text: "The panel writes the verb and nothing else. It lands in the node's command queue with the intent — desired power — and the agent holding that node claims it on the next poll, moves the real process, and reports back. Until it does, the console shows the server as pending, because that is what it is: a requested state, not a reached one.",
        },
        {
          kind: "list",
          items: [
            "start — open the socket and walk the pairing handshake",
            "stop — close cleanly, creds stay on disk",
            "restart — stop, then start again",
            "kill — drop it now: no flush, no goodbye",
          ],
        },
        {
          kind: "p",
          text: "If no agent is attached to the node, the command stays queued and the console says so. That is the whole point of the queue: the panel never claims a socket moved when nothing was there to move it.",
        },
        {
          kind: "code",
          lang: "bash",
          lines: [
            'curl -X POST https://your-panel/api/servers/<uuid>/power \\',
            '  -H "Authorization: Bearer <wings token>" \\',
            '  -d \'{"action":"restart"}\'',
          ],
        },
        {
          kind: "note",
          tone: "ember",
          text: "An install needs the server stopped. Tear the socket down, lay the files down, then bring it back up.",
        },
      ],
    },
    {
      id: "eggs",
      label: "Eggs",
      icon: FileCode,
      blurb: "A manifest plus every file an agent needs to run.",
      body: [
        {
          kind: "p",
          text: "An egg is the unit of reuse, and it lives on a nest. It declares what the agent is — name, description, runtime image, startup command, stop command, install script — and ships the files that make it real: index.js, package.json, a premium store, a README.",
        },
        {
          kind: "p",
          text: "In a bot context, installing an egg means three concrete things, and the node's agent does all of them: it writes the egg's files into the server's volume (that folder is the bot's source tree), it runs the egg's install script inside that folder and streams everything the script printed back as the install transcript, and it records the startup line — node index.js — as what the agent boots whenever the server is switched on. Nothing is marked installed until a real install script has run.",
        },
        {
          kind: "list",
          items: [
            "image — the runtime it pulls, the egg's Docker image equivalent",
            "startup — the command wings runs to boot the agent, e.g. node index.js",
            "stopCommand — the signal sent on stop, usually SIGTERM",
            "installScript — what runs once before the first start, e.g. npm install",
            "config.env — the variables the install asks you for before it starts",
          ],
        },
        {
          kind: "p",
          text: "Anyone can submit one. A steward reads the manifest and the files, then publishes it or sends it back; until then it is pending and only its author can see it.",
        },
        {
          kind: "code",
          lang: "json",
          lines: [
            "{",
            '  "name": "Blast Runner",',
            '  "description": "Send a templated blast to a list of JIDs.",',
            '  "category": "Blast",',
            '  "tags": ["blast", "queue"],',
            '  "runtime": "nodejs_22",',
            '  "image": "ghcr.io/kaizen/baileys:nodejs22",',
            '  "startup": "node index.js",',
            '  "stopCommand": "SIGTERM",',
            '  "installScript": "npm install",',
            '  "config": {',
            '    "env": { "PREFIX": "", "DELAY_MS": "4000" }',
            "  }",
            "}",
          ],
        },
        {
          kind: "p",
          text: "Paths in an uploaded file set are normalised: a leading ./ is stripped, and anything absolute or containing .. is dropped rather than written. An egg can only ever write inside its own directory.",
        },
      ],
    },
    {
      id: "runtimes",
      label: "Runtimes",
      icon: Cpu,
      blurb: "The base an egg is built against, with its Baileys version.",
      body: [
        {
          kind: "p",
          text: "A runtime pins the language version and the Baileys release an egg assumes. Installing against a different runtime is refused rather than left to fail at boot, because a mismatched socket is a miserable thing to debug.",
        },
        ...(runtimes
          ? ([
              {
                kind: "table" as const,
                head: ["Runtime", "Node", "Baileys", "Reach for it when"],
                rows: runtimes.map((r) => [
                  r.id,
                  r.nodeVersion,
                  r.baileysVersion,
                  r.description,
                ]),
              },
            ] as Block[])
          : ([
              {
                kind: "p",
                text: "The runtime list is loading — the five we ship are Node.js 22, 20 and 18, Bun and Deno.",
              },
            ] as Block[])),
        {
          kind: "note",
          tone: "ember",
          text: "Node.js 22 LTS is the default for new agents. Deno is the one to pick when you want the sandbox tightened.",
        },
      ],
    },
    {
      id: "wings",
      label: "Wings",
      icon: Terminal,
      blurb: "The agent on the node: the socket, the volume, the console.",
      body: [
        {
          kind: "p",
          text: "Wings is a real process you run on your own machine — the panel never holds a websocket. Convex cannot keep a socket alive for weeks, so the agent does: it authenticates with the node's wings token, heartbeats so the panel can tell when a node is offline, claims power and send commands from a queue, and owns one live @whiskeysockets/baileys socket per server.",
        },
        {
          kind: "p",
          text: "Everything the panel shows is something the agent reported: the QR comes from connection.update, the pairing code from requestPairingCode, sent messages from sock.sendMessage, inbound from messages.upsert, meters from the process itself, and webhook deliveries from those same events. Stop means the socket closed; kill means it was dropped without a flush; and the creds are saved both on the agent's disk and in the server's volume, so a restart does not ask you to link the device again.",
        },
        {
          kind: "code",
          lang: "bash",
          lines: [
            "npm install @whiskeysockets/baileys",
            "NODE_TOKEN=wings_... \\",
            "KAIZEN_PANEL=https://your-deployment.convex.cloud \\",
            "node wings-agent.mjs",
          ],
        },
        {
          kind: "note",
          tone: "neon",
          text: "The agent is served from this site at /wings-agent.mjs, and the console hands you the exact command with your deployment's URL filled in.",
        },
        {
          kind: "code",
          lang: "javascript",
          lines: [
            "const sock = makeWASocket();",
            "",
            'sock.ev.on("messages.upsert", async ({ messages }) => {',
            "  const msg = messages[0];",
            "  const text = msg?.message?.conversation ?? \"\";",
            '  if (text === "!ping") {',
            '    await sock.sendMessage(msg.key.remoteJid, { text: "pong" });',
            "  }",
            "});",
          ],
        },
        {
          kind: "p",
          text: "Your code never imports the SDK. Wings hands it a socket with the same names a real Baileys socket has, and require is wired to the server's own files — so require('./premium.json') reads the copy the install laid down. On a node that socket is the live one; in this site's playground it is a stand-in, so you can try a script before you install it.",
        },
        {
          kind: "note",
          tone: "ember",
          text: "The sandbox is a playground, not a jail. For code you did not write, run the daemon yourself — that is the boundary worth having.",
        },
      ],
    },
    {
      id: "files",
      label: "File manager",
      icon: FolderTree,
      blurb: "The server's volume: upload a folder, edit in place, pull it back out.",
      body: [
        {
          kind: "p",
          text: "Every server has a volume and the file manager is the editor for it — the same thing SFTP gives you on a real node. Drop a folder of scripts from your desktop and the relative paths are preserved, so a project arrives with its shape intact. Open any file to edit it in place, rename it, or download it back.",
        },
        {
          kind: "table",
          head: ["Limit", "Value"],
          rows: [
            ["Per file", "512 KB"],
            ["Per upload", "200 files"],
            ["Types", ".js .mjs .cjs .json .txt .md .env .yaml .yml .sh .ts .html .css"],
            ["Folders", "Created for you, including any missing parents"],
          ],
        },
        {
          kind: "p",
          text: "Text only. This is a place for scripts and manifests, not binary assets — an image or an audio clip has nowhere useful to go on a server's volume.",
        },
      ],
    },
    {
      id: "api",
      label: "API & events",
      icon: Webhook,
      blurb: "Panel keys for the outside world, webhooks for the inside.",
      body: [
        {
          kind: "p",
          text: "Two ways to get data out. A panel key is a bearer credential for talking to the panel from something that is not a browser. A webhook is the other direction: the panel POSTs to you when something happens on a server.",
        },
        {
          kind: "list",
          items: [
            "connection.update — the socket opened, closed or reported an error",
            "messages.upsert — an inbound message landed",
            "message-receipt.update — a message was sent, delivered or read",
            "creds.update — the linked-device credentials changed",
          ],
        },
        {
          kind: "note",
          tone: "neon",
          text: "Panel keys are shown once at creation and stored hashed. If one leaks, delete it and make another — there is no way to read it back.",
        },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[280px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTag tone="holo">documentation</SectionTag>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            The manual
          </h1>
        </div>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Six sections, in the order you meet them. Everything below describes
          something the panel actually does — the limits, the statuses and the
          event names are the ones in the code.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
          {/* ---- Contents ---- */}
          <nav className="lg:sticky lg:top-24 lg:h-fit">
            <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-mist">
              <BookOpen className="size-3" />
              On this page
            </p>
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-mist transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <s.icon className="size-3.5" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-edge pt-4">
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to="/eggs">
                  <Search className="size-3" />
                  Browse eggs
                </Link>
              </Button>
            </div>
          </nav>

          {/* ---- Body ---- */}
          <div className="min-w-0 space-y-14">
            {sections.map((section, i) => (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.05 }}
                className="scroll-mt-24"
              >
                <div className="flex items-center gap-2.5">
                  <section.icon className="size-4 text-neon" />
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    {section.label}
                  </h2>
                </div>
                <p className="mt-1.5 text-sm text-mist">{section.blurb}</p>
                <div className="mt-5 space-y-4">
                  {section.body.map((block, j) => (
                    <BlockView key={j} block={block} />
                  ))}
                </div>
              </motion.section>
            ))}

            <div className="slab holo-border p-7">
              <Radio className="size-5 text-ember" />
              <h2 className="mt-3 font-display text-lg font-bold">
                Enough reading — make a session
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pair a device, install the starter bot, and watch it answer in
                the console. It takes about two minutes.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/dashboard/sessions">
                    Open the panel
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/wings">
                    <KeyRound className="size-4" />
                    Read about wings
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "p") {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
    );
  }

  if (block.kind === "note") {
    return (
      <div
        className={cn(
          "rounded-xl border p-4 text-sm leading-relaxed",
          block.tone === "ember"
            ? "border-ember/30 bg-ember/[0.06] text-ember/90"
            : "border-neon/30 bg-neon/[0.05] text-neon/90",
        )}
      >
        {block.text}
      </div>
    );
  }

  if (block.kind === "list") {
    return (
      <ul className="space-y-2">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-neon" />
            <span className="font-mono text-[12px]">{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.kind === "code") {
    return (
      <div className="slab overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
          <Terminal className="size-3 text-mist" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-mist">
            {block.lang}
          </span>
        </div>
        <pre className="well m-3 overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-sky-200">
          {block.lines.join("\n")}
        </pre>
      </div>
    );
  }

  return (
    <div className="slab overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70">
            {block.head.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-mist"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row[0]} className="border-b border-white/5 last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-2.5 align-top leading-relaxed",
                    i === 0
                      ? "font-mono text-[12px] whitespace-nowrap text-neon"
                      : "text-muted-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
