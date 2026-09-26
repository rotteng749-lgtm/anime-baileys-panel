#!/usr/bin/env node
/**
 * Kaizen wings agent — the real Baileys runtime.
 *
 * Convex cannot hold a websocket that lives for weeks, so the socket lives
 * here, in a process you run next to your machines. This file is the whole
 * daemon: it authenticates with a node's wings token, heartbeats, claims
 * commands, and owns one real `@whiskeysockets/baileys` socket per server.
 *
 *   node wings-agent.mjs
 *
 * Environment:
 *   KAIZEN_PANEL      Convex deployment URL, e.g. https://xyz.convex.cloud
 *   NODE_TOKEN        the node's wings token (shown once when it was created)
 *   KAIZEN_SESSIONS   where session volumes live (default ./kaizen-sessions)
 *   KAIZEN_NAME       agent name shown in the panel (default hostname)
 *   KAIZEN_VERSION    version string reported to the panel
 *   KAIZEN_HEARTBEAT_MS / KAIZEN_POLL_MS / KAIZEN_METERS_MS
 *
 * Install once:
 *   npm install @whiskeysockets/baileys
 *
 * What it does for real, and why each piece is here:
 *   1. opens a Baileys socket per server — no simulation anywhere
 *   2. emits the QR / pairing code the socket produced (`connection.update`,
 *      `requestPairingCode`) straight to the panel
 *   3. sends with `sock.sendMessage` and mirrors `messages.upsert` back
 *   4. persists creds two ways: `useMultiFileAuthState` on disk *and* the
 *      volume in the panel, so a restart never logs the device out
 *   5. executes the four power verbs against the live process
 *   6. runs an egg's install script and boots its startup command
 *   7. everything it reports is what drives webhook delivery
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const PANEL = String(
  process.env.KAIZEN_PANEL ?? process.env.CONVEX_URL ?? "",
).replace(/\/+$/, "");
const TOKEN = String(process.env.NODE_TOKEN ?? process.env.KAIZEN_NODE_TOKEN ?? "");
const NAME = String(process.env.KAIZEN_NAME ?? os.hostname());
const ROOT = path.resolve(process.env.KAIZEN_SESSIONS ?? "./kaizen-sessions");
const VERSION = String(process.env.KAIZEN_VERSION ?? "1.0.0");
const HEARTBEAT_MS = Number(process.env.KAIZEN_HEARTBEAT_MS ?? 5_000);
const POLL_MS = Number(process.env.KAIZEN_POLL_MS ?? 2_000);
const METERS_MS = Number(process.env.KAIZEN_METERS_MS ?? 10_000);
const MAX_FILE_BYTES = 512 * 1024;

if (!PANEL) {
  console.error("[wings] KAIZEN_PANEL is not set — point it at your Convex deployment.");
  process.exit(1);
}
if (!TOKEN) {
  console.error("[wings] NODE_TOKEN is not set — copy the wings token for this node.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Baileys                                                            */
/* ------------------------------------------------------------------ */

/**
 * Baileys, loaded on demand.
 *
 * `--check` proves the agent-to-panel wiring on a machine that has no Baileys
 * installed and no phone to link, so the import happens the first time a
 * socket is actually needed.
 */
let baileysApi = null;
let baileysNamespace = null;

async function loadBaileys() {
  if (baileysApi) return baileysApi;

  let mod;
  try {
    mod = await import("@whiskeysockets/baileys");
  } catch (error) {
    console.error(
      "[wings] @whiskeysockets/baileys is not installed. Run `npm install @whiskeysockets/baileys` next to this file.\n" +
        String(error?.message ?? error),
    );
    process.exit(1);
  }

  const ns = mod.default && typeof mod.default === "object" ? mod.default : mod;
  const api = {
    namespace: ns,
    makeWASocket: ns.makeWASocket ?? mod.makeWASocket ?? mod.default,
    useMultiFileAuthState: ns.useMultiFileAuthState ?? mod.useMultiFileAuthState,
    fetchLatestBaileysVersion:
      ns.fetchLatestBaileysVersion ?? mod.fetchLatestBaileysVersion,
    DisconnectReason: ns.DisconnectReason ?? mod.DisconnectReason ?? {},
    Browsers: ns.Browsers ?? mod.Browsers,
  };

  if (typeof api.makeWASocket !== "function") {
    console.error(
      "[wings] this Baileys build does not export makeWASocket — upgrade the package.",
    );
    process.exit(1);
  }

  baileysApi = api;
  baileysNamespace = ns;
  return api;
}

/* ------------------------------------------------------------------ */
/* Talking to the panel                                               */
/* ------------------------------------------------------------------ */

/**
 * One HTTP call into the deployment.
 *
 * The agent is not a Convex client — it posts to the same public HTTP API the
 * browser does, with the node token in the body. Every function it touches is
 * token-gated, so a leaked agent can only ever reach its own node's servers.
 */
async function call(kind, fnPath, args) {
  const response = await fetch(`${PANEL}/api/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: fnPath, args, format: "json" }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  if (!response.ok || (payload && payload.status === "error")) {
    const detail =
      payload && typeof payload === "object"
        ? (payload.errorMessage ?? JSON.stringify(payload))
        : String(payload);
    throw new Error(`${fnPath} → ${response.status}: ${String(detail).slice(0, 300)}`);
  }

  return payload && typeof payload === "object" && "value" in payload
    ? payload.value
    : payload;
}

const nodeCall = (fnPath, args = {}) => call("action", fnPath, { ...args, token: TOKEN });
const apiCall = (fnPath, args = {}) => call("query", `wingsApi:${fnPath}`, { token: TOKEN, ...args });
const apiWrite = (fnPath, args = {}) => call("mutation", `wingsApi:${fnPath}`, { token: TOKEN, ...args });

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

/** uuid → session. One entry per server this agent is holding. */
const sessions = new Map();
/** uuid → the server object from the last heartbeat. */
let inventory = new Map();
let shuttingDown = false;

function volumeFor(uuid) {
  return path.join(ROOT, uuid);
}

function log(message) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${message}`);
}

/** Report something the panel should see in a server's console. */
async function report(session, level, message) {
  log(`${session?.uuid?.slice(0, 8) ?? "node"} ${message}`);
  if (!session) return;
  try {
    await nodeCall("runtime:event", {
      uuid: session.uuid,
      event: "log",
      data: { level, message },
    });
  } catch (error) {
    console.error(`[wings] could not report a log line: ${error.message}`);
  }
}

/** Push a socket event into the panel. Failures are logged, never fatal. */
async function push(session, event, data) {
  try {
    await nodeCall("runtime:event", { uuid: session?.uuid, event, data });
  } catch (error) {
    console.error(`[wings] event ${event} failed: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* MIME → message body                                               */
/* ------------------------------------------------------------------ */

function messageBody(message) {
  const m = message ?? {};
  if (typeof m.conversation === "string") return m.conversation;
  if (typeof m.extendedTextMessage?.text === "string") return m.extendedTextMessage.text;
  if (typeof m.imageMessage?.caption === "string") return m.imageMessage.caption;
  if (typeof m.videoMessage?.caption === "string") return m.videoMessage.caption;
  if (typeof m.buttonsResponseMessage?.selectedDisplayText === "string") {
    return m.buttonsResponseMessage.selectedDisplayText;
  }
  if (typeof m.listResponseMessage?.title === "string") return m.listResponseMessage.title;
  if (m.imageMessage) return "[image]";
  if (m.videoMessage) return "[video]";
  if (m.audioMessage) return "[audio]";
  if (m.stickerMessage) return "[sticker]";
  if (m.documentMessage) return m.documentMessage.fileName ?? "[document]";
  if (m.locationMessage) return "[location]";
  if (m.contactMessage) return "[contact]";
  if (m.pollCreationMessage || m.pollCreationMessageV3) return "[poll]";
  return "[unsupported]";
}

function messageKind(message) {
  const m = message ?? {};
  if (m.imageMessage) return "image";
  if (m.stickerMessage) return "sticker";
  if (m.documentMessage) return "file";
  if (m.locationMessage) return "location";
  if (m.contactMessage) return "contact";
  if (m.pollCreationMessage || m.pollCreationMessageV3) return "poll";
  return "text";
}

/** What to hand `sock.sendMessage` for each kind the panel offers. */
function contentFor(kind, body) {
  if (kind === "poll") {
    const [question, ...rest] = body.split("|");
    return { poll: { name: question.trim() || "Poll", values: rest.length ? rest : ["Yes", "No"] } };
  }
  if (kind === "location") {
    const [lat, lng, label] = body.split(",");
    return {
      location: {
        degreesLatitude: Number(lat) || 0,
        degreesLongitude: Number(lng) || 0,
        name: (label ?? "").trim() || undefined,
      },
    };
  }
  // text, sticker, image, contact and file all arrive as text/links from the
  // panel's dispatch form; the socket sends exactly what it was given.
  return { text: body };
}

function statusReason(lastDisconnect) {
  const error = lastDisconnect?.error;
  if (!error) return undefined;
  return String(error.output?.payload?.message ?? error.message ?? error);
}

/* ------------------------------------------------------------------ */
/* Baileys plumbing                                                   */
/* ------------------------------------------------------------------ */

/** A pino-shaped logger that forwards the interesting lines to the console. */
function sessionLogger(session) {
  const forward = (level, args) => {
    const text = args
      .map((arg) => (typeof arg === "string" ? arg : safeStringify(arg)))
      .join(" ")
      .trim();
    if (text) void report(session, level, `[baileys] ${text.slice(0, 400)}`);
  };
  return {
    level: "warn",
    child: () => sessionLogger(session),
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (...args) => forward("warn", args),
    error: (...args) => forward("error", args),
    fatal: (...args) => forward("error", args),
    silent: () => {},
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Write every auth file the panel already has back onto this machine. */
async function restoreAuth(session) {
  const authDir = path.join(session.dir, "auth");
  fs.mkdirSync(authDir, { recursive: true });
  if (fs.readdirSync(authDir).length > 0) return 0;

  const files = await apiCall("apiListFiles", { uuid: session.uuid });
  const authFiles = files.filter((f) => !f.is_dir && f.name.startsWith("auth/"));
  let restored = 0;
  for (const file of authFiles) {
    if (file.size > MAX_FILE_BYTES) continue;
    const read = await apiCall("apiReadFile", {
      uuid: session.uuid,
      path: file.name,
    });
    const target = path.join(session.dir, read.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, read.contents);
    restored += 1;
  }
  if (restored > 0) {
    await report(session, "info", `[wings] restored ${restored} auth files from the volume — no relink needed`);
  }
  return restored;
}

/**
 * Push the creds up into the panel volume.
 *
 * `creds.json` and the app-state keys go up on every `creds.update` — those are
 * the ones that decide whether a restart stays logged in. The bulk of the
 * ratchet (pre-keys, sessions) is synced on start and on a slow timer, because
 * there can be hundreds of them and Baileys rebuilds what it needs.
 */
async function syncAuth(session, { full = false } = {}) {
  const authDir = path.join(session.dir, "auth");
  if (!fs.existsSync(authDir)) return 0;

  const names = fs.readdirSync(authDir);
  const wanted = full
    ? names
    : names.filter(
        (name) =>
          name === "creds.json" ||
          name.startsWith("app-state-sync") ||
          name.startsWith("session-"),
      );

  let synced = 0;
  for (const name of wanted.slice(0, 400)) {
    const target = path.join(authDir, name);
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
    try {
      await apiWrite("apiWriteFile", {
        uuid: session.uuid,
        path: `auth/${name}`,
        contents: fs.readFileSync(target, "utf8"),
      });
      synced += 1;
    } catch (error) {
      console.error(`[wings] auth sync failed for ${name}: ${error.message}`);
      break;
    }
  }
  return synced;
}

/** Unlink on disk: the socket is gone, so the keys must be too. */
async function wipeAuth(session) {
  const authDir = path.join(session.dir, "auth");
  if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
  try {
    const files = await apiCall("apiListFiles", { uuid: session.uuid });
    for (const file of files) {
      if (!file.is_dir && file.name.startsWith("auth/")) {
        await apiWrite("apiDeleteFile", { uuid: session.uuid, path: file.name });
      }
    }
  } catch (error) {
    console.error(`[wings] could not wipe the volume creds: ${error.message}`);
  }
}

/** The egg's source tree, pulled down from the panel's volume. */
async function pullVolume(session) {
  const files = await apiCall("apiListFiles", { uuid: session.uuid });
  let written = 0;
  for (const file of files) {
    const target = path.join(session.dir, file.name);
    if (file.is_dir) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) continue;
    const read = await apiCall("apiReadFile", {
      uuid: session.uuid,
      path: file.name,
    });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, read.contents);
    written += 1;
  }
  return written;
}

/* ------------------------------------------------------------------ */
/* The socket                                                         */
/* ------------------------------------------------------------------ */

async function openSocket(session, { fresh = false } = {}) {
  if (session.sock) return session.sock;

  fs.mkdirSync(session.dir, { recursive: true });
  await restoreAuth(session);
  if (fresh) await wipeAuth(session);

  const baileys = await loadBaileys();
  const { state, saveCreds } = await baileys.useMultiFileAuthState(
    path.join(session.dir, "auth"),
  );
  const latest = await baileys.fetchLatestBaileysVersion().catch(() => null);
  session.disconnectReason = baileys.DisconnectReason;

  const sock = baileys.makeWASocket({
    version: latest?.version,
    auth: state,
    logger: sessionLogger(session),
    printQRInTerminal: false,
    browser:
      baileys.Browsers?.ubuntu?.(`Kaizen ${VERSION}`) ?? [
        "Kaizen Panel",
        "Chrome",
        VERSION,
      ],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
  });

  session.sock = sock;
  session.stopping = false;
  session.pairingRequested = false;

  // ---- creds: persist locally, then push the important half to the panel ----
  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
    } catch (error) {
      await report(session, "warn", `[wings] could not write creds: ${error.message}`);
    }
    await push(session, "creds.update", {
      registered: Boolean(sock.authState?.creds?.registered),
      me: sock.user ?? null,
    });
    await syncAuth(session);
  });

  // ---- connection lifecycle: this is where the QR comes from ----
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await push(session, "connection.update", { connection: "connecting" });
      await push(session, "connection.update", { connection: "qr", qr });
    }

    if (connection === "connecting") {
      await push(session, "connection.update", { connection: "connecting" });
      // A code-pairing session asks for its code instead of printing a QR.
      if (
        session.pairMethod === "code" &&
        !session.pairingRequested &&
        !sock.authState?.creds?.registered
      ) {
        session.pairingRequested = true;
        setTimeout(() => void requestPairingCode(session), 3_000);
      }
    }

    if (connection === "open") {
      session.reconnects = 0;
      await push(session, "connection.update", {
        connection: "open",
        jid: sock.user?.id ?? null,
        pushName: sock.user?.name ?? sock.user?.verifiedName ?? null,
      });
      await syncAuth(session, { full: true });
      await bootEntrypoint(session);
      return;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = statusReason(lastDisconnect);
      const loggedOut =
        statusCode === 401 || statusCode === session.disconnectReason?.loggedOut;
      session.sock = null;

      await push(session, "connection.update", {
        connection: "close",
        statusCode,
        reason: loggedOut ? "logged out" : (reason ?? "connection closed"),
      });

      if (loggedOut) {
        await wipeAuth(session);
        await push(session, "power", {
          state: "stopped",
          reason: "logged out",
          pid: process.pid,
        });
        return;
      }

      if (session.stopping || session.desired === "stopped" || shuttingDown) return;

      // Baileys does not reconnect for us; the panel's intent does.
      session.reconnects = (session.reconnects ?? 0) + 1;
      const wait = Math.min(30_000, 1_500 * session.reconnects);
      await report(
        session,
        "warn",
        `[wings] dropped (${statusCode ?? "?"}) — reconnecting in ${Math.round(wait / 1000)}s`,
      );
      await sleep(wait);
      if (!session.stopping && session.desired !== "stopped" && !shuttingDown) {
        await ensureRunning(session);
      }
    }
  });

  // ---- traffic: real messages, real receipts, real auto-reply ----
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    const batch = [];
    for (const message of messages ?? []) {
      if (!message?.message) continue;
      const jid = message.key?.remoteJid ?? "";
      if (!jid) continue;
      batch.push({
        id: message.key?.id ?? null,
        jid,
        fromMe: Boolean(message.key?.fromMe),
        pushName: message.pushName ?? null,
        body: messageBody(message.message),
        kind: messageKind(message.message),
        timestamp: Math.floor(Number(message.messageTimestamp ?? 0) * 1000) || Date.now(),
      });
    }
    if (batch.length === 0) return;

    await push(session, "messages.upsert", { type: type ?? "notify", messages: batch });

    if (session.autoReply !== true || !session.prefix) return;
    for (const row of batch) {
      if (row.fromMe) continue;
      if (row.jid === "status@broadcast" || row.jid.endsWith("@g.us")) continue;
      if (String(row.body).startsWith("!")) continue;
      try {
        const sent = await sock.sendMessage(row.jid, {
          text: `${session.prefix} received — an agent will be with you shortly.`,
        });
        await push(session, "message.sent", {
          clientId: `auto_${sent?.key?.id ?? Date.now()}`,
          jid: row.jid,
          body: `${session.prefix} received — an agent will be with you shortly.`,
          ok: true,
          id: sent?.key?.id ?? null,
        });
      } catch (error) {
        await report(session, "error", `[wings] auto-reply failed — ${error.message}`);
      }
    }
  });

  sock.ev.on("message-receipt.update", async (receipts) => {
    for (const receipt of receipts ?? []) {
      const status = receipt.receipt?.readTimestamp
        ? "read"
        : receipt.receipt?.playTimestamp
          ? "delivered"
          : "delivered";
      await push(session, "message.receipt.update", {
        jid: receipt.key?.remoteJid ?? null,
        status,
      });
    }
  });

  await push(session, "power", { state: "running", pid: process.pid });
  return sock;
}

/** Ask WhatsApp for the phone-number pairing code, and report it. */
async function requestPairingCode(session) {
  const sock = session.sock;
  if (!sock) return;
  const digits = String(session.phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) {
    await report(session, "warn", "[wings] pairing code requested but this server has no phone number");
    return;
  }
  try {
    const code = await sock.requestPairingCode(digits);
    await push(session, "pairing.code", { code, phone: digits });
  } catch (error) {
    await report(session, "warn", `[wings] requestPairingCode failed — ${error.message}`);
  }
}

/**
 * Boot the egg's entrypoint with the real socket in scope.
 *
 * Eggs are written against a small bridge — `makeWASocket()`, `baileys`,
 * `sleep`, `require` — the same shape the public sandbox uses. Here the socket
 * is the live one, so the bot's listeners fire on real traffic and its
 * `sendMessage` goes to a real number.
 */
async function bootEntrypoint(session) {
  const startup = String(session.startup ?? "node index.js");
  const match = /^\s*(?:node|bun)\s+(?:--[\w-]+\s+)*([./\w-]+)/.exec(startup);
  if (!match) {
    await report(session, "info", `[wings] startup \`${startup}\` is not an entrypoint the embedded runtime boots`);
    return;
  }

  const entry = path.resolve(session.dir, match[1]);
  if (!fs.existsSync(entry)) {
    await report(session, "info", `[wings] no ${match[1]} yet — install an egg to give this server a bot`);
    return;
  }

  const localRequire = createRequire(path.join(session.dir, "package.json"));
  globalThis.makeWASocket = () => session.sock;
  globalThis.baileys = baileysNamespace;
  globalThis.sleep = (ms) => sleep(ms);
  globalThis.require = localRequire;
  globalThis.__kaizen = {
    uuid: session.uuid,
    dir: session.dir,
    status: () => (session.sock?.authState?.creds?.registered ? "connected" : "connecting"),
  };

  try {
    await import(`${pathToFileURL(entry).href}?v=${Date.now()}`);
    await report(session, "success", `[wings] ${path.basename(entry)} loaded — bot logic is attached to the socket`);
  } catch (error) {
    await report(session, "error", `[wings] ${path.basename(entry)} threw on boot — ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Power                                                              */
/* ------------------------------------------------------------------ */

function sessionFor(uuid, source = "heartbeat") {
  if (!uuid) return null;
  let session = sessions.get(uuid);
  if (!session) {
    session = {
      uuid,
      dir: volumeFor(uuid),
      sock: null,
      desired: "stopped",
      stopping: false,
      reconnects: 0,
      autoReply: false,
      prefix: null,
      pairMethod: "qr",
      phone: null,
      startup: "node index.js",
      source,
    };
    sessions.set(uuid, session);
  }
  const info = inventory.get(uuid);
  if (info) {
    session.name = info.name;
    session.desired = info.desired_power ?? session.desired;
    session.autoReply = info.auto_reply ?? session.autoReply;
    session.prefix = info.prefix ?? session.prefix;
    session.pairMethod = info.pair_method ?? session.pairMethod;
    session.phone = info.phone ?? session.phone;
    session.startup = info.startup ?? session.startup;
  }
  return session;
}

async function ensureRunning(session) {
  session.desired = "running";
  session.stopping = false;
  await openSocket(session);
}

async function closeSocket(session, { force = false, reason = "stopped" } = {}) {
  session.stopping = true;
  session.desired = "stopped";
  const sock = session.sock;
  session.sock = null;

  if (sock) {
    try {
      if (force) {
        // SIGKILL semantics: drop the transport now, no flush, no goodbye.
        sock.ws?.terminate?.();
        sock.end?.(new Error("killed by the panel"));
      } else {
        // SIGTERM semantics: end the stream, leave the creds alone.
        sock.end?.(undefined) ?? sock.ws?.close?.();
        await sleep(400);
      }
    } catch (error) {
      await report(session, "warn", `[wings] socket close complained — ${error.message}`);
    }
  }

  await push(session, "power", { state: "stopped", reason, pid: process.pid });
}

/* ------------------------------------------------------------------ */
/* Commands                                                           */
/* ------------------------------------------------------------------ */

async function ack(command, status, result) {
  try {
    await nodeCall("runtime:ack", {
      commandId: command.id,
      status,
      result: result ? String(result).slice(0, 400) : undefined,
    });
  } catch (error) {
    console.error(`[wings] ack failed: ${error.message}`);
  }
}

async function handleCommand(command) {
  if (command.uuid && !inventory.has(command.uuid)) {
    // The panel may have created this server since our last heartbeat, so
    // refresh once before deciding the command is for a server that is gone.
    await announce().catch(() => undefined);
  }
  if (command.uuid && !inventory.has(command.uuid)) {
    await ack(command, "error", "the panel has no server with that uuid");
    return;
  }

  const session = command.uuid ? sessionFor(command.uuid, "command") : null;
  if (command.uuid && !session) {
    await ack(command, "error", "unknown server");
    return;
  }

  try {
    switch (command.kind) {
      case "start":
      case "restart": {
        if (command.kind === "restart") await closeSocket(session, { reason: "restarting" });
        await ensureRunning(session);
        await ack(command, "done");
        return;
      }
      case "stop": {
        await closeSocket(session, { reason: "stopped by operator" });
        await ack(command, "done");
        return;
      }
      case "kill": {
        await closeSocket(session, { force: true, reason: "killed by operator (no flush)" });
        await ack(command, "done");
        return;
      }
      case "pairing": {
        await ensureRunning(session);
        await sleep(1_000);
        await requestPairingCode(session);
        await ack(command, "done");
        return;
      }
      case "logout": {
        const sock = session.sock;
        if (sock) {
          try {
            await sock.logout();
          } catch (error) {
            await report(session, "warn", `[wings] logout() failed — ${error.message}`);
          }
        }
        session.sock = null;
        if (command.payload?.wipeCreds !== false) await wipeAuth(session);
        await push(session, "power", { state: "stopped", reason: "logged out", pid: process.pid });
        await ack(command, "done");
        return;
      }
      case "send": {
        await handleSend(session, command);
        return;
      }
      case "install": {
        await handleInstall(session, command);
        return;
      }
      default: {
        await report(session, "warn", `[wings] unknown command ${command.kind}`);
        await ack(command, "error", "unknown command");
      }
    }
  } catch (error) {
    await report(session, "error", `[wings] ${command.kind} failed — ${error.message}`);
    await ack(command, "error", error.message);
  }
}

async function handleSend(session, command) {
  const { clientId, to, body, kind } = command.payload ?? {};
  const sock = session.sock;

  if (!sock) {
    await push(session, "message.sent", {
      clientId,
      jid: to,
      body,
      ok: false,
      error: "the socket is not open",
    });
    await ack(command, "error", "the socket is not open");
    return;
  }

  try {
    const sent = await sock.sendMessage(to, contentFor(kind, String(body ?? "")));
    await push(session, "message.sent", {
      clientId,
      jid: to,
      body,
      ok: true,
      id: sent?.key?.id ?? null,
    });
    await ack(command, "done");
  } catch (error) {
    await push(session, "message.sent", {
      clientId,
      jid: to,
      body,
      ok: false,
      error: error.message,
    });
    await ack(command, "error", error.message);
  }
}

/**
 * Install an egg for real.
 *
 * Pull the volume (the egg's files are already in it), run the egg's install
 * script in the session directory, and stream what it printed back as the
 * install transcript. The startup line is recorded by the panel side, so the
 * next start boots it.
 */
async function handleInstall(session, command) {
  const payload = command.payload ?? {};
  const installId = payload.installId;

  const line = async (text) => {
    await push(session, "install", { installId, status: "installing", line: text });
  };

  await line(`wings ${VERSION} — pulling the volume for ${payload.eggName ?? "the egg"}`);
  const pulled = await pullVolume(session);
  await line(`${pulled} files in place at ${session.dir}`);

  const script = String(payload.installScript ?? "").trim();
  const hasManifest = fs.existsSync(path.join(session.dir, "package.json"));

  if (payload.skipScripts) {
    await line("skip_scripts is on — install script skipped");
  } else if (!script) {
    await line("this egg has no install script — nothing to run");
  } else if (!hasManifest && /^(npm|bun|yarn|pnpm)\b/.test(script)) {
    await line(`install script \`${script}\` skipped — the egg ships no package.json`);
  } else {
    await line(`$ ${script}`);
    const output = await runShell(script, session.dir);
    for (const row of output.split("\n").slice(-60)) {
      if (row.trim()) await line(row.trim().slice(0, 300));
    }
  }

  await push(session, "install", {
    installId,
    status: "installed",
    line: `installed — startup is \`${payload.startup ?? "node index.js"}\``,
    startup: payload.startup ?? null,
    image: payload.image ?? null,
    eggName: payload.eggName ?? null,
  });

  await ack(command, "done");
}

function runShell(command, cwd) {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, CI: "1" },
      },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ?? ""}`.trim();
        if (error) {
          resolve(`${output}\n${error.message}`);
          return;
        }
        resolve(output || "(no output)");
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Loops                                                              */
/* ------------------------------------------------------------------ */

let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();

function cpuPercent() {
  const usage = process.cpuUsage(lastCpu);
  const elapsedMs = Math.max(1, Date.now() - lastCpuAt);
  lastCpu = process.cpuUsage();
  lastCpuAt = Date.now();
  return Math.min(100, Math.round(((usage.user + usage.system) / 1000 / elapsedMs) * 100));
}

/**
 * Say hello and pick up the servers this node owns.
 *
 * Pure presence — no socket is opened here, which is what makes `--check` safe
 * to run beside a live agent.
 */
async function announce() {
  const info = await nodeCall("runtime:heartbeat", {
    name: NAME,
    version: VERSION,
    sessions: liveSockets(),
    pid: process.pid,
  });
  inventory = new Map((info?.servers ?? []).map((server) => [server.uuid, server]));
  return info;
}

/**
 * Presence plus reconciliation: an agent holds whatever the panel says should
 * be running, and drops whatever it says should be stopped.
 */
async function heartbeat() {
  const servers = await announce();

  for (const server of servers?.servers ?? []) {
    if (!server.uuid) continue;
    const session = sessionFor(server.uuid, "heartbeat");
    if (server.desired_power === "running" && !session.sock && !session.stopping) {
      await report(session, "info", "[wings] desired state is running — opening the socket");
      await ensureRunning(session);
    } else if (server.desired_power === "stopped" && session.sock) {
      await closeSocket(session, { reason: "desired state is stopped" });
    }
  }
  return servers;
}

function liveSockets() {
  let count = 0;
  for (const session of sessions.values()) if (session.sock) count += 1;
  return count;
}

async function pollOnce() {
  const commands = await nodeCall("runtime:poll", { limit: 12 });
  for (const command of commands ?? []) {
    log(`command ${command.kind} ${command.uuid ? command.uuid.slice(0, 8) : ""}`);
    await handleCommand(command);
  }
}

async function metersOnce() {
  const live = [...sessions.values()].filter((session) => session.sock);
  if (live.length === 0) return;
  const rss = process.memoryUsage().rss / (1024 * 1024);
  const cpu = cpuPercent();
  const share = Math.max(1, live.length);
  for (const session of live) {
    await push(session, "meters", {
      cpu: Math.round(cpu / share),
      memoryMb: Math.round(rss / share),
    });
  }
}

async function authSweep() {
  for (const session of sessions.values()) {
    if (!session.sock) continue;
    await syncAuth(session, { full: true });
    await push(session, "creds.update", {
      registered: Boolean(session.sock?.authState?.creds?.registered),
      me: session.sock?.user ?? null,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  fs.mkdirSync(ROOT, { recursive: true });
  log(`wings ${VERSION} — node "${NAME}", volume root ${ROOT}`);
  log(`panel ${PANEL}`);

  const info = await heartbeat();
  log(
    `authenticated as ${info?.node?.id ?? "?"} (${info?.node?.location ?? "unknown location"}) — ` +
      `${(info?.servers ?? []).length} server(s) on this node`,
  );

  setInterval(() => {
    void heartbeat().catch((error) => console.error(`[wings] heartbeat: ${error.message}`));
  }, HEARTBEAT_MS);

  setInterval(() => {
    if (shuttingDown) return;
    void pollOnce().catch((error) => console.error(`[wings] poll: ${error.message}`));
  }, POLL_MS);

  setInterval(() => {
    if (shuttingDown) return;
    void metersOnce().catch((error) => console.error(`[wings] meters: ${error.message}`));
  }, METERS_MS);

  // The slow auth sweep: pre-keys and sessions, in the background.
  setInterval(() => {
    if (shuttingDown) return;
    void authSweep().catch((error) => console.error(`[wings] auth sweep: ${error.message}`));
  }, 5 * 60_000);

  void authSweep().catch(() => {});

  log("holding. power, sends and installs are live.");
}

process.on("SIGINT", async () => {
  shuttingDown = true;
  log("shutting down — closing sockets cleanly");
  for (const session of sessions.values()) {
    await closeSocket(session, { reason: "agent shutting down" });
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error(`[wings] unhandled rejection: ${error?.message ?? error}`);
});

/**
 * `node wings-agent.mjs --check`
 *
 * The fastest way to tell a wiring problem from a socket problem: it
 * authenticates with the token, registers a heartbeat, prints what this node
 * owns, and exits. No Baileys, no WhatsApp account, no long-running process.
 *
 * Run it when the panel says "no agent is holding this node" and you are not
 * sure whether the token, the URL or the machine is the problem.
 */
async function selfCheck() {
  log(`wings ${VERSION} — check mode (no socket will be opened)`);
  log(`panel ${PANEL}`);

  const info = await announce();
  log(
    `authenticated as ${info?.node?.id} (${info?.node?.name} · ${info?.node?.location})`,
  );
  log(`daemon ${info?.node?.daemon} · agent name "${NAME}" · pid ${process.pid}`);

  const servers = info?.servers ?? [];
  if (servers.length === 0) {
    log("this node has no servers yet — create one in the panel and it shows up here");
  } else {
    for (const server of servers) {
      log(
        `  ${String(server.uuid ?? "").slice(0, 8)}  ${server.name}  desired=${server.desired_power}  actual=${server.power}  ${server.status}`,
      );
    }
    const waiting = servers.filter((s) => s.desired_power === "running");
    if (waiting.length > 0) {
      log(
        `${waiting.length} server(s) are waiting for a socket — run this again without --check to hold them`,
      );
    }
  }

  log("wiring is good. the panel will show this agent for the next 30 seconds.");
}

const CHECK = process.argv.includes("--check") || process.env.KAIZEN_CHECK === "1";

if (CHECK) {
  await selfCheck().catch((error) => {
    console.error(`[wings] check failed: ${error.message}`);
    process.exit(1);
  });
  process.exit(0);
}

await main().catch((error) => {
  console.error(`[wings] could not start: ${error.message}`);
  process.exit(1);
});
