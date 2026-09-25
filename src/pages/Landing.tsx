import { KaizenMark, KaizenWordmark, SectionTag } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cable,
  Cpu,
  Layers,
  Link2,
  MessagesSquare,
  QrCode,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import { Link } from "react-router";

const CONSOLE_LINES = [
  { t: "info", m: "[baileys] connecting to wss://web.whatsapp.com/ws/chat" },
  { t: "success", m: "[baileys] QR ref received — scan to link" },
  { t: "info", m: "[baileys] connection.update — connection: open" },
  { t: "info", m: "[baileys] logged in as 6281234567890@s.whatsapp.net" },
  { t: "info", m: "[messages.upsert] Rika <6281234567> — hai kak!" },
  { t: "cmd", m: "sendText(6281234567890@s.whatsapp.net, on it!)" },
  { t: "debug", m: "[receipt] delivered ← 6281234567890" },
];

const LINE_COLOR: Record<string, string> = {
  info: "text-sky-200",
  success: "text-emerald-300",
  cmd: "text-neon",
  debug: "text-mist",
};

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/panel" : "/auth?returnTo=/panel";
  const secondaryTo = isAuthenticated ? "/panel/sessions" : "/auth?returnTo=/panel";

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[820px] opacity-70" />
      <div className="screentone pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-30" />

      {/* ================= Nav ================= */}
      <header className="relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <KaizenWordmark />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#capabilities" className="transition-colors hover:text-foreground">
              Capabilities
            </a>
            <a href="#workflow" className="transition-colors hover:text-foreground">
              Workflow
            </a>
            <a href="#stack" className="transition-colors hover:text-foreground">
              Stack
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={isAuthenticated ? "/panel" : "/auth"}>
                {isAuthenticated ? "Console" : "Sign in"}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={primaryTo}>
                {isAuthenticated ? "Open panel" : "Get started"}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ================= Hero ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8 sm:pt-16">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionTag tone="neon">Baileys control plane</SectionTag>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="gradient-text text-glow">Run every</span>
              <br />
              WhatsApp socket
              <br />
              <span className="text-muted-foreground">from one deck.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Kaizen wraps{" "}
              <span className="font-mono text-foreground">@whiskeysockets/baileys</span>{" "}
              in a control panel built for operators: pair devices with a QR ref
              or an 8-digit code, stream the socket console live, and dispatch
              text, media, polls and locations without touching a terminal.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to={primaryTo}>
                  <Zap className="size-4" />
                  {isAuthenticated ? "Back to the panel" : "Launch the panel"}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to={secondaryTo}>
                  <Terminal className="size-4" />
                  See the console
                </Link>
              </Button>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.36 }}
              className="mt-12 grid max-w-lg grid-cols-3 gap-3"
            >
              {[
                { k: "Session types", v: "QR + code" },
                { k: "Event stream", v: "Realtime" },
                { k: "Auth", v: "Scoped keys" },
              ].map((stat) => (
                <div key={stat.k} className="stat-chip px-3 py-3">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.2em] text-mist">
                    {stat.k}
                  </dt>
                  <dd className="mt-1 font-display text-sm font-bold text-foreground">
                    {stat.v}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* ---- Floating console mock ---- */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateY: -12 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative [perspective:1400px]"
          >
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-neon/12 blur-3xl" />
            <div className="app-frame relative rounded-2xl">
              {/* title bar */}
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
                <span className="size-2.5 rounded-full bg-rose-400/80" />
                <span className="size-2.5 rounded-full bg-amber-300/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 font-mono text-[11px] text-mist">
                  support-desk — baileys socket
                </span>
                <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  streaming
                </span>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-[1.35fr_1fr]">
                <div className="well h-64 overflow-hidden p-3.5 font-mono text-[10.5px] leading-relaxed sm:h-72">
                  {CONSOLE_LINES.map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.11, duration: 0.3 }}
                      className={LINE_COLOR[line.t]}
                    >
                      {line.m}
                    </motion.p>
                  ))}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ repeat: Infinity, duration: 1.1 }}
                    className="inline-block h-3 w-2 bg-neon align-middle"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="stat-chip flex flex-col items-center gap-2 p-3">
                    <div className="grid grid-cols-5 gap-[2px] rounded bg-white p-2">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <span
                          key={i}
                          className="size-1.5 bg-abyss"
                          style={{ opacity: (i * 7) % 5 === 0 ? 0.15 : 1 }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold text-mist">Scan to pair</p>
                  </div>

                  <div className="stat-chip space-y-2.5 p-3">
                    <Meter label="CPU" value={38} />
                    <Meter label="Memory" value={186} />
                  </div>
                </div>
              </div>
            </div>

            <div className="float-slow absolute -right-3 -bottom-6 hidden sm:block">
              <div className="holo-border flex items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2 shadow-[0_18px_40px_-20px_oklch(0_0_0/90%)]">
                <Radar className="size-4 text-emerald-300" />
                <span className="text-[11px] font-semibold">2 devices online</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= Capabilities ================= */}
      <section id="capabilities" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <SectionTag tone="holo">Capabilities</SectionTag>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a WhatsApp bot needs,
            <span className="gradient-text"> surfaced properly.</span>
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            The panel is organised the way operators actually work: fleet at a
            glance, a console per device, and integrations that hand events to
            your own code.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: QrCode,
              title: "QR & code pairing",
              body: "Scan the ref from WhatsApp → Linked devices, or request an 8-digit pairing code when the phone camera is the wrong tool.",
              tone: "neon" as const,
            },
            {
              icon: Terminal,
              title: "Live socket console",
              body: "connection.update, creds.update, messages.upsert, receipts — streamed line by line, with level colouring and autoscroll.",
              tone: "holo" as const,
            },
            {
              icon: Send,
              title: "Full send surface",
              body: "Text, image, video, audio, file, sticker, poll, location and contact — the whole BaileysClass API from one composer.",
              tone: "sakura" as const,
            },
            {
              icon: Cpu,
              title: "Fleet telemetry",
              body: "Per-session CPU and memory with 24-hour traffic history, so a flapping socket is obvious before your users notice.",
              tone: "mint" as const,
            },
            {
              icon: Webhook,
              title: "Event fan-out",
              body: "Point any endpoint at connection, message, receipt or credential events and keep your bot logic where it belongs.",
              tone: "neon" as const,
            },
            {
              icon: ShieldCheck,
              title: "Scoped credentials",
              body: "Every session is owned by an account. API keys are hashed at rest and revealed exactly once at creation.",
              tone: "holo" as const,
            },
          ].map((feature, i) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="slab group p-6 transition-transform duration-200 hover:-translate-y-1.5"
            >
              <div
                className={`mb-5 flex size-12 items-center justify-center rounded-xl border border-edge bg-gradient-to-br from-surface-3 to-abyss shadow-[inset_0_1px_0_oklch(1_0_0/18%)] transition-transform duration-200 group-hover:scale-110 ${
                  feature.tone === "neon"
                    ? "text-neon"
                    : feature.tone === "holo"
                      ? "text-holo"
                      : feature.tone === "sakura"
                        ? "text-sakura"
                        : "text-emerald-300"
                }`}
              >
                <feature.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-bold">{feature.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ================= Workflow ================= */}
      <section id="workflow" className="relative z-10 border-y border-border/50 bg-abyss/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionTag tone="sakura">Workflow</SectionTag>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                From zero to a linked device
                <span className="gradient-text"> in three moves.</span>
              </h2>

              <ol className="mt-9 space-y-6">
                {[
                  {
                    n: "01",
                    icon: Cable,
                    title: "Provision a session",
                    body: "Name it, pick a pairing method, and the panel opens the websocket. A real Baileys socket logs the same line you see in the console.",
                  },
                  {
                    n: "02",
                    icon: Link2,
                    title: "Pair the phone",
                    body: "Scan the QR ref or type the pairing code. On success the socket reports connection: open and the JID it logged in as.",
                  },
                  {
                    n: "03",
                    icon: MessagesSquare,
                    title: "Answer traffic",
                    body: "Inbound events land in the console and the message inbox. Dispatch replies from the composer, or hand everything to a webhook.",
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <span className="clip-shuriken flex h-11 w-11 shrink-0 items-center justify-center border border-neon/40 bg-neon/10 text-neon">
                        <step.icon className="size-4" />
                      </span>
                      <span className="mt-2 w-px flex-1 bg-gradient-to-b from-edge to-transparent" />
                    </div>
                    <div className="pb-2">
                      <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-neon">
                        STEP {step.n}
                      </p>
                      <h3 className="mt-1.5 font-display text-lg font-bold">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="slab overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
                <span className="size-2.5 rounded-full bg-rose-400/80" />
                <span className="size-2.5 rounded-full bg-amber-300/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 font-mono text-[11px] text-mist">
                  bot.js — your runtime
                </span>
              </div>
              <pre className="well m-3 overflow-x-auto p-4 text-[11px] leading-relaxed text-mist">
                <code>{`import { BaileysClass } from "@bot-wa/bot-wa-baileys";

const bot = new BaileysClass({
  usePairingCode: true,
  phoneNumber: "6281234567890",
});

bot.on("ready", async () => {
  console.log("READY BOT");
});

bot.on("message", async (message) => {
  await bot.sendPoll(message.from, "Pick one", {
    options: ["text", "media", "sticker"],
    multiselect: false,
  });
});`}</code>
              </pre>
              <p className="px-5 pb-5 text-xs leading-relaxed text-muted-foreground">
                The panel supervises these sockets. Your bot keeps the logic; the
                deck handles pairing, telemetry and traffic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Stack ================= */}
      <section id="stack" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Layers, k: "Protocol", v: "Baileys 6.x", d: "The WhatsApp multi-device library, unmodified." },
            { icon: Sparkles, k: "Realtime", v: "Convex", d: "Subscriptions push socket state the moment it changes." },
            { icon: Terminal, k: "Interface", v: "React + Vite", d: "Typed end to end, with shadcn primitives underneath." },
            { icon: ShieldCheck, k: "Auth", v: "Convex Auth", d: "Account-scoped sessions and hashed panel keys." },
          ].map((item, i) => (
            <motion.div
              key={item.k}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="slab p-5"
            >
              <item.icon className="size-5 text-neon" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-mist">
                {item.k}
              </p>
              <p className="mt-1 font-display text-lg font-bold">{item.v}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative z-10 px-5 pb-24 sm:px-8">
        <div className="app-frame relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-14">
          <div className="anime-grid absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.6_0.16_235/28%),transparent)]" />

          <div className="relative">
            <div className="flex justify-center">
              <KaizenMark size={54} />
            </div>
            <h2 className="mt-7 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <span className="gradient-text text-glow">Your fleet, online.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              Provision a session, scan the code, and watch the socket come up.
              Free to run — you bring the numbers.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to={primaryTo}>
                  {isAuthenticated ? "Open the panel" : "Create your first session"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="relative z-10 border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <KaizenWordmark compact />
          <p className="text-center text-xs text-mist">
            Built on Baileys · WhatsApp is a trademark of its respective owner.
          </p>
          <a
            href="https://github.com/whiskeysockets/Baileys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-neon transition-colors hover:text-holo"
          >
            Baileys on GitHub →
          </a>
        </div>
      </footer>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-mist">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="well h-1.5 overflow-hidden rounded-full p-[1.5px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon to-holo shadow-[0_0_8px_oklch(0.78_0.16_210/70%)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
