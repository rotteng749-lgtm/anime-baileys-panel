/**
 * The base catalogue: runtimes an egg can target, and the official eggs that
 * ship with the panel. Written out here so the seeds read as data rather than
 * as a wall of database calls.
 *
 * Nothing here is copied from anywhere — these are original manifests and
 * scripts written for this panel.
 */

import { KAIZEN_EGG } from "./botSeed";

export const RUNTIMES = [
  {
    id: "nodejs_22",
    label: "Node.js 22 LTS",
    nodeVersion: "22",
    baileysVersion: "^6.12.0",
    description:
      "Current long-term support. The default target for new bots.",
  },
  {
    id: "nodejs_20",
    label: "Node.js 20 LTS",
    nodeVersion: "20",
    baileysVersion: "^6.12.0",
    description:
      "Still maintained. Pick this if a dependency has not caught up with 22.",
  },
  {
    id: "nodejs_18",
    label: "Node.js 18",
    nodeVersion: "18",
    baileysVersion: "^6.7.0",
    description:
      "Older, but the most widely supported across legacy bot libraries.",
  },
  {
    id: "bun",
    label: "Bun",
    nodeVersion: "20",
    baileysVersion: "^6.12.0",
    description:
      "Fast startup and a built-in bundler. Good for bots that restart often.",
  },
  {
    id: "deno",
    label: "Deno",
    nodeVersion: "20",
    baileysVersion: "^6.9.0",
    description:
      "Permissions-first runtime. Use when you want the sandbox tightened.",
  },
] as const;

const STARTER_ENTRY = `// Runs on wings. The socket is already in scope — no import needed.
const sock = makeWASocket();
const PREFIX = process.env.PREFIX || "Kaizen";

console.log("starter bot ready on", baileys.sessionStatus);

sock.ev.on("connection.update", ({ connection }) => {
  console.log("connection:", connection);
});

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  const text = msg?.message?.conversation?.trim();
  if (!text || msg.key.fromMe) return;

  if (text === "!ping") {
    await sock.sendMessage(msg.key.remoteJid, { text: "pong" });
    return;
  }

  if (text === "!info") {
    await sock.sendMessage(msg.key.remoteJid, {
      text: \`\${PREFIX} running on node \${process.version}\`,
    });
  }
});
`;

const STARTER_PKG = `{
  "name": "kaizen-bot",
  "version": "1.0.0",
  "private": true,
  "description": "A WhatsApp bot on Baileys",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.12.0"
  }
}
`;

const BLAST_INDEX = `// Works through queue.json at a controlled pace, so a campaign goes out
// without tripping rate limits. Replace the sample list with your own.
const sock = makeWASocket();
const DELAY_MS = Number(process.env.DELAY_MS || 4000);
const PREFIX = process.env.PREFIX || "";

let running = false;

async function drainQueue() {
  if (running) return;
  running = true;
  try {
    const queue = require("./queue.json");
    for (const entry of queue) {
      const jid = entry.to.includes("@") ? entry.to : \`\${entry.to}@s.whatsapp.net\`;
      await sock.sendMessage(jid, {
        text: PREFIX ? \`\${PREFIX}: \${entry.body}\` : entry.body,
      });
      console.log(\`sent to \${entry.to}\`);
      await sleep(DELAY_MS);
    }
  } finally {
    running = false;
  }
}

sock.ev.on("connection.update", ({ connection }) => {
  if (connection !== "open") return;
  console.log("blast runner ready");
  void drainQueue();
});

sock.ev.on("messages.upsert", ({ messages }) => {
  if (messages[0]?.message?.conversation?.trim() === "!blast") {
    void drainQueue();
  }
});
`;

const BLAST_QUEUE = `[
  { "to": "6281234567890", "body": "Hello from the blast runner." },
  { "to": "6281234567891", "body": "Second message in the queue." }
]
`;

const REPLY_INDEX = `// Keyword rules that answer the repetitive questions while nobody is awake.
const sock = makeWASocket();

const PREFIX = process.env.PREFIX || "Kaizen Bot";
const RULES = {
  price: "Our starter plan is free. Book a slot if you need something custom.",
  hours: "We are around 09:00 to 17:00, weekdays.",
  human: "Leave it with me — I will reply personally within the hour.",
};

sock.ev.on("connection.update", ({ connection }) => {
  if (connection === "open") console.log("auto-reply pack ready");
});

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  const text = msg?.message?.conversation?.toLowerCase()?.trim();
  if (!text || msg.key.fromMe) return;

  for (const [keyword, reply] of Object.entries(RULES)) {
    if (text.includes(keyword)) {
      await sock.sendMessage(msg.key.remoteJid, { text: \`\${PREFIX}: \${reply}\` });
      return;
    }
  }
});
`;

const WEBHOOK_INDEX = `// Forwards socket events to an endpoint of your choosing.
const sock = makeWASocket();
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function forward(event, payload) {
  if (!WEBHOOK_URL) {
    console.warn("no WEBHOOK_URL set, dropping", event);
    return;
  }
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kaizen-event": event,
    },
    body: JSON.stringify(payload),
  });
  console.log(\`forwarded \${event} -> \${res.status}\`);
}

sock.ev.on("connection.update", async ({ connection, lastError }) => {
  if (connection === "open") {
    await forward("connection.update", { connection });
  }
  if (connection === "close") {
    await forward("connection.update", {
      connection,
      error: lastError?.error?.message ?? "unknown",
    });
  }
});

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg?.message?.conversation) return;
  await forward("messages.upsert", {
    from: msg.key.remoteJid,
    body: msg.message.conversation,
  });
});
`;

export const EGGS = [
  ...[KAIZEN_EGG],
  {
    slug: "starter-bot",
    name: "Starter Bot",
    author: "panel",
    description:
      "The smallest thing worth running: a keyword responder on a single linked number. Start here, then make it yours.",
    category: "Starter",
    tags: ["starter", "keywords", "single-device"],
    runtime: "nodejs_22",
    image: "ghcr.io/kaizen/baileys:nodejs22",
    startup: "node index.js",
    stopCommand: "SIGTERM",
    installScript: "npm install",
    env: ["NODE_ENV=production"],
    accent: "neon" as const,
    files: [
      { path: "index.js", contents: STARTER_ENTRY },
      { path: "package.json", contents: STARTER_PKG },
      {
        path: "README.md",
        contents:
          "# Starter Bot\n\nRuns on Node 22 against a single linked number.\n\n1. Install the egg on a session.\n2. Pair the number with a QR scan or a pairing code.\n3. Start the session and watch the console.\n",
      },
    ],
  },
  {
    slug: "blast-runner",
    name: "Blast Runner",
    author: "panel",
    description:
      "Works through a queue file at a controlled pace, so a campaign goes out without tripping rate limits.",
    category: "Blast",
    tags: ["queue", "pacing", "campaign"],
    runtime: "nodejs_22",
    image: "ghcr.io/kaizen/baileys:nodejs22",
    startup: "node index.js",
    stopCommand: "SIGTERM",
    installScript: "npm install",
    env: ["NODE_ENV=production", "DELAY_MS=4000"],
    accent: "ember" as const,
    files: [
      { path: "index.js", contents: BLAST_INDEX },
      { path: "package.json", contents: STARTER_PKG },
      { path: "queue.json", contents: BLAST_QUEUE },
      {
        path: "README.md",
        contents:
          "# Blast Runner\n\nEdit `queue.json` with your own numbers, then send `!blast` to the bot or wait for it to drain on ready.\n",
      },
    ],
  },
  {
    slug: "auto-reply-pack",
    name: "Auto-reply Pack",
    author: "panel",
    description:
      "Keyword rules that answer the repetitive questions — pricing, hours, handover — without a human awake.",
    category: "Auto-reply",
    tags: ["rules", "keywords", "oow"],
    runtime: "nodejs_20",
    image: "ghcr.io/kaizen/baileys:nodejs20",
    startup: "node index.js",
    stopCommand: "SIGTERM",
    installScript: "npm install",
    env: ["NODE_ENV=production", "PREFIX=Kaizen Bot"],
    accent: "holo" as const,
    files: [
      { path: "index.js", contents: REPLY_INDEX },
      { path: "package.json", contents: STARTER_PKG },
      {
        path: "README.md",
        contents:
          "# Auto-reply Pack\n\nEdit the `RULES` object in `index.js` to match your own answers.\n",
      },
    ],
  },
  {
    slug: "webhook-bridge",
    name: "Webhook Bridge",
    author: "panel",
    description:
      "Forwards every inbound message to an endpoint of your choosing, with the event name in a header.",
    category: "Developer",
    tags: ["webhook", "events", "http"],
    runtime: "nodejs_22",
    image: "ghcr.io/kaizen/baileys:nodejs22",
    startup: "node index.js",
    stopCommand: "SIGTERM",
    installScript: "npm install",
    env: ["WEBHOOK_URL="],
    accent: "sakura" as const,
    files: [
      { path: "index.js", contents: WEBHOOK_INDEX },
      { path: "package.json", contents: STARTER_PKG },
      {
        path: "README.md",
        contents:
          "# Webhook Bridge\n\nSet `WEBHOOK_URL` in the install variables, then point that endpoint at your own service.\n",
      },
    ],
  },
] as const;

/* ------------------------------------------------------------------ */
/* Seed helpers                                                       */
/* ------------------------------------------------------------------ */

type SeedCtx = {
  // The seeder only ever calls query().collect() and insert().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

export async function seedRuntimes(ctx: SeedCtx) {
  const existing = new Set(
    (await ctx.db.query("runtimes").collect()).map(
      (r: { id: string }) => r.id,
    ),
  );
  let added = 0;
  for (const runtime of RUNTIMES) {
    if (existing.has(runtime.id)) continue;
    await ctx.db.insert("runtimes", { ...runtime });
    added += 1;
  }
  return added;
}

export async function seedEggs(ctx: SeedCtx) {
  const rows = (await ctx.db.query("eggs").collect()) as {
    _id: string;
    slug: string;
    [key: string]: unknown;
  }[];
  const bySlug = new Map(rows.map((e) => [e.slug, e]));
  let added = 0;

  for (const egg of EGGS) {
    const existing = bySlug.get(egg.slug);
    if (existing) {
      // The panel's own eggs track this file: when an entrypoint is rewritten
      // here, the shipped copy is brought forward so an existing install picks
      // up the new code on its next install.
      const stale = (await ctx.db
        .query("eggFiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex("by_egg", (q: any) => q.eq("eggId", existing._id))
        .collect()) as { _id: string; path: string; contents: string }[];
      const shipped = new Map(stale.map((f) => [f.path, f]));
      for (const file of egg.files) {
        const row = shipped.get(file.path);
        if (row && row.contents !== file.contents) {
          await ctx.db.patch(row._id, { contents: file.contents });
        }
      }

      // Manifest fields too — an egg that gains an image or a stop command
      // should not need a fresh deployment to pick it up.
      const current = existing as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries({
        name: egg.name,
        description: egg.description,
        category: egg.category,
        runtime: egg.runtime,
        image: egg.image,
        startup: egg.startup,
        stopCommand: egg.stopCommand,
        installScript: egg.installScript,
        accent: egg.accent,
      })) {
        if (value !== undefined && current[key] !== value) patch[key] = value;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id as never, patch);
      }
      continue;
    }

    const eggId = await ctx.db.insert("eggs", {
      slug: egg.slug,
      name: egg.name,
      author: egg.author,
      description: egg.description,
      category: egg.category,
      tags: [...egg.tags],
      runtime: egg.runtime,
      image: egg.image,
      startup: egg.startup,
      stopCommand: egg.stopCommand,
      installScript: egg.installScript,
      env: [...egg.env],
      accent: egg.accent,
      official: true,
      status: "published",
      installs: 0,
      createdAt: Date.now() - added * 60_000,
    });

    for (const file of egg.files) {
      await ctx.db.insert("eggFiles", {
        eggId,
        path: file.path,
        contents: file.contents,
        createdAt: Date.now(),
      });
    }
    added += 1;
  }
  return added;
}
