"use node";

import vm from "node:vm";
import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Wings — the per-session agent.
 *
 * A Pterodactyl wings daemon is a small binary that owns one server: it takes
 * commands, keeps the process alive and streams the output back. The Baileys
 * equivalent is smaller — a session is a WhatsApp socket plus a bag of files —
 * so wings here is three things:
 *
 *   1. the file layer, which lives in `files.ts` and needs no runtime at all;
 *   2. this module, a sandbox that actually evaluates an egg's script with a
 *      Baileys-shaped SDK in scope, so an agent can be written and exercised
 *      without a phone attached;
 *   3. the runner below, a single-file Node daemon an operator can run on their
 *      own machine and point at a real @whiskeysockets/baileys socket.
 *
 * The sandbox is a `node:vm` context with no process, no require and no
 * network. It is a playground, not a boundary for untrusted code — for that,
 * the runner is the answer.
 */

const MAX_SOURCE_BYTES = 128 * 1024;
const MAX_OUTPUT_LINES = 200;
const RUN_TIMEOUT_MS = 5_000;

type SandboxResult = {
  ok: boolean;
  exitCode: number;
  output: string[];
  durationMs: number;
  truncated: boolean;
};

/* ------------------------------------------------------------------ */
/* The bridge                                                         */
/* ------------------------------------------------------------------ */

type Listener = (payload: unknown) => void;

/** The smallest event emitter that can stand in for `sock.ev`. */
function makeEmitter() {
  const handlers = new Map<string, Listener[]>();
  return {
    on(event: string, fn: Listener) {
      const list = handlers.get(event) ?? [];
      list.push(fn);
      handlers.set(event, list);
    },
    off(event: string, fn: Listener) {
      handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== fn));
    },
    emit(event: string, payload: unknown) {
      for (const fn of handlers.get(event) ?? []) fn(payload);
    },
    listenerCount(event: string) {
      return (handlers.get(event) ?? []).length;
    },
  };
}

/**
 * The Baileys surface an egg can touch, backed by the panel's own session state.
 *
 * Every call is a local echo: the socket is a stub, so a script can be written,
 * linted and run end to end here and behave identically once it is pointed at
 * the real SDK through the runner. Incoming events are driven by the session
 * status, which the panel already ticks.
 */
function makeSdk(send: (line: string) => void, status: string) {
  const jid = "6281234567890@s.whatsapp.net";
  const ev = makeEmitter();

  // The socket comes up the way a real one does.
  queueMicrotask(() => {
    ev.emit("creds.update", {});
    ev.emit("connection.update", { connection: "connecting" });
    ev.emit("connection.update", { connection: "open", receivedPendingNotifications: false });
  });

  const sock = {
    authState: { creds: { me: { id: jid } }, keys: { get: async () => ({}), set: async () => undefined } },
    ev,
    user: { id: jid, name: "Anime Baileys Agent" },
    authStateCreds: { me: { id: jid } },
    end: async () => undefined,
    sendPresenceUpdate: async () => undefined,
    sendMessage: async (jid_: string, content: unknown) => {
      const preview =
        typeof content === "string"
          ? content
          : (content as { text?: string })?.text ?? JSON.stringify(content);
      send(`[sent] ${jid_}: ${String(preview).slice(0, 120)}`);
      return { key: { id: `SIM${Date.now().toString().slice(-8)}` } };
    },
    groupMetadata: async (groupJid: string) => ({
      id: groupJid,
      subject: "Simulated group",
      participants: [],
    }),
    groupParticipantsUpdate: async () => undefined,
    profilePictureUrl: async () => undefined,
    readMessages: async () => undefined,
    onWhatsApp: async () => true,
    assertBaileys: () => undefined,
  };

  return {
    default: sock,
    makeWASocket: () => sock,
    makeCacheableSignalKeyStore: () => sock.authState.keys,
    proto: {
      WAMessageStub: class {},
      WAMessageContent: { text: (text: string) => ({ text }) },
    },
    downloadMediaMessage: async () => Buffer.alloc(0),
    downloadContentFromMessage: async () => Buffer.alloc(0),
    generateWAMessageFromContent: async (_jid: string, content: unknown) => ({
      key: { id: "SIM" },
      message: content,
    }),
    getContentType: () => "text",
    areJidsSameUser: (a: string, b: string) => a === b,
    isJidGroup: (j: string) => j.endsWith("@g.us"),
    isJidUser: (j: string) => j.endsWith("@s.whatsapp.net"),
    getContentTypeFromMessage: () => "text",
    downloadJidProfilePic: async () => undefined,
    ChatModification: { clear: {} },
    WAMessageStatus: { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, PLAYED: 4 },
    status: "simulated",
    sessionStatus: status,
  };
}

/* ------------------------------------------------------------------ */
/* The sandbox                                                        */
/* ------------------------------------------------------------------ */

/** Parse `KEY=value` pairs into the process.env the script sees. */
function envMap(pairs: string[]) {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
  }
  return out;
}

/**
 * `require` for an egg's own files.
 *
 * An agent that ships a config expects to load it: `require("./queue.json")`
 * reads the copy that the install laid on the session's disk, which the panel
 * passes in alongside the entrypoint. Anything else is a miss, said out loud
 * rather than thrown, so the console shows what the script was reaching for.
 */
function makeRequire(
  files: { path: string; contents: string }[],
  sdk: Record<string, unknown>,
  note: (line: string) => void,
) {
  const own = new Map(files.map((f) => [f.path.replace(/^\.?\//, ""), f.contents]));
  return (specifier: string): unknown => {
    if (specifier === "baileys" || specifier === "@whiskeysockets/baileys") {
      return sdk;
    }
    const contents = own.get(specifier.replace(/^\.?\//, ""));
    if (contents === undefined) {
      note(`[wings] cannot require("${specifier}") — the sandbox only sees this session's own files`);
      return undefined;
    }
    try {
      return JSON.parse(contents);
    } catch {
      return contents;
    }
  };
}

/** Evaluate a script the way a wings process would, and capture its console. */
async function runInSandbox(
  source: string,
  opts: {
    filename: string;
    env: string[];
    status: string;
    files?: { path: string; contents: string }[];
  },
): Promise<SandboxResult> {
  const started = Date.now();
  const output: string[] = [];
  let truncated = false;

  const push = (line: string) => {
    if (output.length >= MAX_OUTPUT_LINES) {
      if (!truncated) {
        truncated = true;
        output.push("… output truncated");
      }
      return;
    }
    output.push(line);
  };

  const env = envMap(opts.env);
  const sdk = makeSdk(push, opts.status);
  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => push(args.map(stringify).join(" ")),
      info: (...args: unknown[]) => push(args.map(stringify).join(" ")),
      warn: (...args: unknown[]) => push("warn: " + args.map(stringify).join(" ")),
      error: (...args: unknown[]) => push("error: " + args.map(stringify).join(" ")),
      debug: () => undefined,
    },
    process: { env, argv: ["node", opts.filename], platform: "node", version: "v22.0.0" },
    env,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    Map,
    Set,
    RegExp,
    URL,
    TextEncoder,
    TextDecoder,
    Buffer,
    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    baileys: sdk,
    makeWASocket: () => sdk.makeWASocket(),
    require: makeRequire(opts.files ?? [], sdk, push),
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  let exitCode = 0;
  try {
    // A `node:vm` script is CommonJS, not a module, so top-level `await` — the
    // shape every egg is written in — needs an async wrapper. The prefix stays
    // on line one so a stack trace still points at the author's line.
    const wrapped = `(async () => {${source}\n})()`;
    const script = new vm.Script(wrapped, { filename: opts.filename });
    await script.runInContext(context, { timeout: RUN_TIMEOUT_MS });
  } catch (err) {
    exitCode = 1;
    const error = err as Error;
    if (/Cannot use import statement/.test(error.message)) {
      push(
        "error: ESM `import` is not available in the sandbox — the wings bridge is already in scope, so use makeWASocket() instead. To run imports for real, use the runner.",
      );
    } else {
      push(String(error?.stack ?? err));
    }
  }

  return { ok: exitCode === 0, exitCode, output, durationMs: Date.now() - started, truncated };
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Run a script the way wings would.
 *
 * The source comes from the caller — the panel reads it off the session's disk
 * with the `files.readFile` query, which is what authorises it — and the script
 * is evaluated here with the Baileys bridge in scope. A script that blows up
 * comes back as output and a non-zero exit code, exactly like a crashed
 * process would.
 */
export const runScript = action({
  args: {
    source: v.string(),
    filename: v.string(),
    env: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
    files: v.optional(v.array(v.object({ path: v.string(), contents: v.string() }))),
  },
  handler: async (_ctx, args): Promise<SandboxResult> => {
    if (args.source.length > MAX_SOURCE_BYTES) {
      throw new Error("Entrypoint is over 128 KB — trim it before running");
    }
    return runInSandbox(args.source, {
      filename: args.filename,
      env: args.env ?? [],
      status: args.status ?? "disconnected",
      files: args.files,
    });
  },
});

/* ------------------------------------------------------------------ */
/* The runner                                                         */
/* ------------------------------------------------------------------ */

/**
 * The downloadable wings runner.
 *
 * A single file an operator runs next to their Baileys install. It opens the
 * real socket, loads the session's `index.js` from disk and wires the panel's
 * SDK shape onto the genuine library, so an egg that passed in the sandbox
 * passes here too.
 */
const RUNNER_LINES: string[] = [
  "#!/usr/bin/env node",
  "/**",
  " * wings-runner — the Baileys wings daemon for Anime Baileys.",
  " *",
  " *   npm install @whiskeysockets/baileys qrcode-terminal",
  " *   BAILEYS_DIR=./sandbox node wings-runner.mjs",
  " *",
  " * It reads the session directory that the panel's file manager produced:",
  " * index.js as the entrypoint, creds.json for the linked-device state and",
  " * package.json for the Baileys version. Everything it prints goes to stdout,",
  " * which is what a local test wants — streaming a live socket into the panel",
  " * is the wings agent's job, not this runner's.",
  " */",
  "",
  "import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';",
  "import { existsSync } from 'node:fs';",
  "import { join, resolve } from 'node:path';",
  "import { pathToFileURL } from 'node:url';",
  "import { createRequire } from 'node:module';",
  "",
  "const DIR = resolve(process.env.BAILEYS_DIR ?? './sandbox');",
  "const ENTRY = process.env.BAILEYS_ENTRY ?? 'index.js';",
  "const SESSION_ID = process.env.SESSION_ID ?? 'local';",
  "",
  "let state = { creds: {}, keys: {}}",
  "try { state = JSON.parse(await readFile(join(DIR, 'creds.json'), 'utf8')); } catch {}",
  "",
  "const stamp = () => new Date().toISOString().slice(11, 19);",
  "async function log(level, message) {",
  "  console.log(`[${stamp()}] [${SESSION_ID}] [${level}] ${message}`);",
  "}",
  "",
  "const useMultiFileAuthState = async () => {",
  "  const { proto, decodeJid } = await import('@whiskeysockets/baileys');",
  "  const { Curve, makeCacheableSignalKeyStore, initAuthCreds } =",
  "    await import('@whiskeysockets/baileys/utils');",
  "  const keyStore = makeCacheableSignalKeyStore(null, null);",
  "  await Promise.all([",
  "    Curve.init('Curve').catch(() => undefined),",
  "    loadCreds().then((c) => (state.creds = c)).catch(() => undefined),",
  "  ]);",
  "  return {",
  "    state: { creds: state.creds, keys: keyStore },",
  "    saveCreds: async () => {",
  "      await mkdir(DIR, { recursive: true });",
  "      await writeFile(join(DIR, 'creds.json'), JSON.stringify(state.creds, null, 2));",
  "    },",
  "    clearCreds: async () => { state.creds = null; },",
  "    registerCors: { origin: '*' },",
  "    decodeJid,",
  "    proto,",
  "    initAuthCreds,",
  "  };",
  "};",
  "",
  "async function loadCreds() { return state.creds ?? { registration: {} }; }",
  "",
  "const baileys = await import('@whiskeysockets/baileys');",
  "const { default: makeWASocket, fetchLatestBaileysVersion } = baileys;",
  "const { version } = await fetchLatestBaileysVersion();",
  "log('wings', `starting on baileys ${version}`);",
  "",
  "const { state: authState, saveCreds } = await useMultiFileAuthState();",
  "",
  "const sock = makeWASocket({",
  "  version,",
  "  auth: authState,",
  "  printQRInTerminal: true,",
  "  logger: {",
  "    level: 'silent',",
  "    child: () => ({ trace: () => {}, debug: () => {}, info: (m) => log('baileys', m),",
  "      warn: (m) => log('warn', m), error: (m) => log('error', m) }),",
  "  },",
  "  connectTimeoutMs: 60_000,",
  "  getMessage: async () => undefined,",
  "});",
  "",
  "sock.ev.on('creds.update', saveCreds);",
  "sock.ev.on('connection.update', async ({ connection, lastError }) => {",
  "  if (connection === 'close') log('error', `closed: ${lastError?.error?.message ?? 'unknown'}`);",
  "  if (connection === 'open') log('wings', 'linked and online');",
  "  if (connection === 'connecting') log('wings', 'handshaking');",
  "});",
  "",
  "for (const event of ['messages.upsert', 'message-receipt.update', 'group.join']) {",
  "  sock.ev.on(event, async (payload) => {",
  "    log('socket', `${event} ${JSON.stringify(payload).slice(0, 200)}`);",
  "  });",
  "}",
  "",
  "const entry = join(DIR, ENTRY);",
  "if (!existsSync(entry)) {",
  "  log('error', `no entrypoint at ${entry} — install an egg from the panel first`);",
  "  process.exit(1);",
  "}",
  "",
  "// The bridge, bound the same way the panel's sandbox binds it: an egg writes",
  "// `makeWASocket()` and `require('./queue.json')` without importing anything.",
  "globalThis.makeWASocket = () => sock;",
  "globalThis.baileys = baileys;",
  "globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));",
  "globalThis.require ??= createRequire(import.meta.url);",
  "",
  "log('wings', `booting ${ENTRY}`);",
  "try {",
  "  await import(pathToFileURL(entry).href);",
  "} catch (err) {",
  "  log('error', `entrypoint threw: ${err.message}`);",
  "  process.exit(1);",
  "}",
  "",
  "process.on('SIGINT', async () => {",
  "  await saveCreds();",
  "  log('wings', 'credentials flushed, bye');",
  "  process.exit(0);",
  "});",
  "",
  "const siblings = await readdir(DIR).catch(() => []);",
  "log('wings', `sandbox holds ${siblings.length} entries`);",
];

/** The runner, as source, so the browser can hand it to a download. */
export const runnerSource = action({
  args: {},
  handler: async (): Promise<{ filename: string; source: string }> => ({
    filename: "wings-runner.mjs",
    source: RUNNER_LINES.join("\n") + "\n",
  }),
});
