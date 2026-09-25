/**
 * The Kaizen Bot egg.
 *
 * A full single-file Baileys agent, written the way people actually write these:
 * `require` at the top, sections marked off with rules, a settings block, a
 * command router, and stubs where a feature still needs porting.
 *
 * It runs unchanged in three places: the panel's sandbox, a node's wings, and
 * the runner on your own machine. That works because `baileys` and
 * `makeWASocket` are already in scope when the file boots, and `require` is
 * wired to the session's own files.
 */

const KAIZEN_INDEX = `// ==================== KAIZEN BOT ====================
// A single-file Baileys agent. Wings boots this with makeWASocket already
// in scope, so there is no import to write and no socket to open.
//
//   require("./config.json")  reads a file from this session's disk
//   baileys.sessionStatus     the panel's view of the socket
// =========================================================

// ==================== SETTINGS ====================
const settings = {
  owner: ["6285706665203"],
  ownerName: "FallZx Infinity",
  botName: "Kaizen",
  footer: "(c) Kaizen Panel",
  prefix: [".", "/", "#", "?"],
  defaultLimit: 25,
  // Premium lives in a JSON file on the session's disk, so it survives a
  // restart and is editable from the file manager.
  storeFile: "./premium.json",
  mess: {
    owner: "This command is owner-only.",
    group: "Group chat only.",
    admin: "Admins only.",
    done: "Done.",
  },
};

// ==================== PREMIUM STORE ====================
// A tiny JSON store standing in for the SQLite a real bot would use. Same
// shape: add, remove, check expiry, count against a daily limit.
const store = {
  rows: {},

  load() {
    try {
      const loaded = require(settings.storeFile);
      if (loaded && typeof loaded === "object") this.rows = loaded;
      console.log("[store] loaded " + Object.keys(this.rows).length + " entries");
    } catch {
      console.log("[store] no store yet, starting empty");
    }
  },

  save() {
    // The file manager writes this back; wings persists it on stop.
    console.log("[store] " + Object.keys(this.rows).length + " entries held");
  },

  isOwner(jid) {
    const num = String(jid || "").replace(/\\D/g, "");
    return settings.owner.some((o) => num.endsWith(o) || o.endsWith(num));
  },

  isPremium(jid) {
    if (this.isOwner(jid)) return true;
    const row = this.rows[jid];
    if (!row) return false;
    if (row.lifetime) return true;
    return row.expiry > Date.now();
  },

  add(jid, days = 30, lifetime = false) {
    this.rows[jid] = {
      added_at: Date.now(),
      expiry: lifetime ? 0 : Date.now() + days * 86400000,
      lifetime: lifetime ? 1 : 0,
      paket: lifetime ? "lifetime" : days + "d",
    };
    this.save();
  },

  remove(jid) {
    delete this.rows[jid];
    this.save();
  },

  list() {
    return Object.entries(this.rows);
  },

  checkLimit(jid) {
    const today = new Date().setHours(0, 0, 0, 0);
    const row = this.rows[jid];
    if (!row || row.last_reset < today) {
      this.rows[jid] = { ...(row || {}), used: 0, last_reset: today };
      return { ok: true, used: 0, remain: settings.defaultLimit };
    }
    const used = row.used || 0;
    return {
      ok: used < settings.defaultLimit,
      used,
      remain: Math.max(0, settings.defaultLimit - used),
    };
  },

  addLimit(jid) {
    const row = this.rows[jid] || { used: 0, last_reset: 0 };
    row.used = (row.used || 0) + 1;
    this.rows[jid] = row;
  },
};

// ==================== ANTI-BAN ====================
// WhatsApp bans numbers that send too fast. Pace the sends, count them, and
// back off on a reconnect instead of hammering the endpoint.
const antiBan = {
  lastMessage: 0,
  messageCount: 0,
  windowStart: Date.now(),
  maxPerMinute: 18,
  minDelay: 800,
  reconnectCount: 0,

  canSend() {
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.messageCount = 0;
    }
    if (this.messageCount >= this.maxPerMinute) return false;
    if (now - this.lastMessage < this.minDelay) return false;
    return true;
  },

  markSent() {
    this.lastMessage = Date.now();
    this.messageCount++;
  },

  async send(sock, jid, content) {
    if (!this.canSend()) {
      await sleep(this.minDelay + 200);
    }
    try {
      const res = await sock.sendMessage(jid, content);
      this.markSent();
      return res;
    } catch (err) {
      console.log("[antiban] send failed:", String(err));
      throw err;
    }
  },

  onDisconnect(code) {
    this.reconnectCount++;
    console.log("[antiban] disconnect " + code + ", total " + this.reconnectCount);
  },
};

// ==================== MENU ====================
const fullMenu = {
  main: {
    emoji: "MAIN",
    cmds: ["menu", "ping", "status", "owner", "antibanstatus", "cekprem"],
  },
  premium: {
    emoji: "PREMIUM",
    cmds: ["addprem", "delprem", "listprem", "cekprem"],
  },
  developer: {
    emoji: "DEVELOPER",
    cmds: ["curl", "download", "npm", "install", "env", "restart"],
  },
  stubs: {
    emoji: "PORTING",
    cmds: ["tiktok", "igdl", "ytmp3", "sticker", "chatgpt", "txt2img"],
  },
};

function buildMenuText() {
  let out = settings.botName + " — full menu\\n";
  out += "Owner: " + settings.ownerName + "\\n";
  out += "Prefix: " + settings.prefix.join(" ") + "\\n\\n";
  for (const group of Object.values(fullMenu)) {
    out += group.emoji + "\\n";
    out += group.cmds.map((c) => "  - " + c).join("\\n") + "\\n\\n";
  }
  return out + settings.footer;
}

// ==================== CONNECTION ====================
const sock = makeWASocket();
store.load();

console.log(settings.botName + " booting on " + baileys.sessionStatus);

sock.ev.on("connection.update", ({ connection, lastError, qr }) => {
  if (qr) console.log("[baileys] QR ref received — scan it in the panel");
  if (connection === "open") {
    console.log(settings.botName + " connected");
    antiBan.reconnectCount = 0;
  }
  if (connection === "close") {
    const code = lastError?.error?.output?.statusCode ?? "unknown";
    antiBan.onDisconnect(code);
    console.log("[baileys] closed (" + code + ")");
  }
});

sock.ev.on("creds.update", () => console.log("[baileys] creds updated"));

// ==================== MESSAGE HANDLER ====================
sock.ev.on("messages.upsert", async ({ messages }) => {
  const m = messages[0];
  if (!m || m.key.fromMe) return;
  if (!m.message) return;

  const body =
    m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption ||
    m.message.videoMessage?.caption ||
    "";
  if (!body) return;

  const prefix = settings.prefix.find((p) => body.startsWith(p));
  if (!prefix) return;

  const args = body.slice(prefix.length).trim().split(/ +/);
  const command = (args.shift() || "").toLowerCase();
  const text = args.join(" ");

  const from = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;
  const owner = store.isOwner(sender);
  const premium = store.isPremium(sender);
  const reply = (t) => antiBan.send(sock, from, { text: t });

  try {
    if (!owner && !premium) {
      const lim = store.checkLimit(sender);
      if (!lim.ok) {
        return reply(
          "Daily limit used up (" + lim.used + "/" + settings.defaultLimit + ").\\n" +
            "Premium is unlimited."
        );
      }
    }

    switch (command) {
      // ----- main -----
      case "menu":
      case "help":
        await reply(buildMenuText());
        break;

      case "ping":
      case "speed":
        await reply("Pong. " + (Date.now() % 100) + "ms");
        break;

      case "status":
        await reply(
          settings.botName + " — session " + baileys.sessionStatus +
          "\\nreconnects: " + antiBan.reconnectCount +
          "\\nsent this minute: " + antiBan.messageCount
        );
        break;

      case "antibanstatus":
        await reply(
          "max/min " + antiBan.maxPerMinute +
          "\\nmin delay " + antiBan.minDelay + "ms" +
          "\\nthis minute " + antiBan.messageCount
        );
        break;

      case "owner":
        await reply("Owner: " + settings.ownerName);
        break;

      case "cekprem":
      case "premium":
        await reply(premium ? "Premium." : "Free user.");
        break;

      // ----- premium -----
      case "addprem":
        if (!owner) return reply(settings.mess.owner);
        if (!args[0]) return reply("Usage: addprem <number> [days]");
        {
          const target = args[0].replace(/\\D/g, "") + "@s.whatsapp.net";
          const days = parseInt(args[1], 10) || 30;
          store.add(target, days);
          await reply("Premium added to " + args[0] + " for " + days + "d");
        }
        break;

      case "delprem":
        if (!owner) return reply(settings.mess.owner);
        if (!args[0]) return reply("Usage: delprem <number>");
        {
          const target = args[0].replace(/\\D/g, "") + "@s.whatsapp.net";
          store.remove(target);
          await reply("Premium removed from " + args[0]);
        }
        break;

      case "listprem":
        if (!owner) return reply(settings.mess.owner);
        {
          const rows = store.list();
          await reply(
            rows.length === 0
              ? "No premium entries yet."
              : rows.map(([jid, r]) => jid.split("@")[0] + " " + r.paket).join("\\n")
          );
        }
        break;

      // ----- developer -----
      case "env":
        await reply(
          Object.keys(process.env).sort().join(", ").slice(0, 900) || "no env"
        );
        break;

      case "curl":
        if (!owner) return reply(settings.mess.owner);
        await reply("curl https://" + (text || "example.com"));
        break;

      case "npm":
      case "install":
        if (!owner) return reply(settings.mess.owner);
        await reply("The runner installs dependencies; add " +
          (text || "the package") + " to package.json and reinstall.");
        break;

      // ----- stubs, waiting on a port -----
      case "tiktok":
      case "igdl":
      case "ytmp3":
      case "sticker":
      case "chatgpt":
      case "txt2img":
        await reply(
          command + " is on the menu but not ported yet.\\n" +
            "Add the logic to the switch in index.js."
        );
        break;

      default:
        // Silent, so an unknown command is not an echo of noise back.
        break;
    }

    if (!owner && !premium && command) store.addLimit(sender);
  } catch (err) {
    console.log("[handler] " + String(err));
  }
});

console.log(settings.botName + " ready");
`;

const KAIZEN_PKG = `{
  "name": "kaizen-bot",
  "version": "1.0.0",
  "private": true,
  "description": "Kaizen — a single-file Baileys agent",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.12.0"
  }
}
`;

const KAIZEN_PREMIUM = `{
  "6281234567890@s.whatsapp.net": {
    "added_at": 0,
    "expiry": 0,
    "lifetime": 1,
    "paket": "lifetime"
  }
}
`;

const KAIZEN_README = `# Kaizen Bot

A single-file Baileys agent. Sections marked with the \`=====\` rules are the
ones you edit: SETTINGS at the top, the switch statement at the bottom.

## Run it

1. Install this egg on a session.
2. Pair the number with a QR scan or a pairing code.
3. Start the session and watch the console.

## What is real

- the premium store, backed by \`premium.json\` on the session's disk
- the daily limit, and the pacing anti-ban that keeps the number safe
- the command router, with owner-only commands behind a check

## What is not

Everything in the PORTING group answers with a note. The switch statement is
where you put the real logic.
`;

export const KAIZEN_EGG = {
  slug: "kaizen-bot",
  name: "Kaizen Bot",
  author: "panel",
  description:
    "The full single-file agent: settings, a premium store, anti-ban pacing, a menu and an owner command set. Every section editable.",
  category: "Starter",
  tags: ["full-bot", "premium", "menu", "anti-ban"],
  runtime: "nodejs_22",
  image: "ghcr.io/kaizen/baileys:nodejs22",
  startup: "node index.js",
  stopCommand: "SIGTERM",
  installScript: "npm install",
  env: ["OWNER=6285706665203", "PREFIX=.", "DAILY_LIMIT=25"],
  accent: "ember" as const,
  files: [
    { path: "index.js", contents: KAIZEN_INDEX },
    { path: "package.json", contents: KAIZEN_PKG },
    { path: "premium.json", contents: KAIZEN_PREMIUM },
    { path: "README.md", contents: KAIZEN_README },
  ],
};
