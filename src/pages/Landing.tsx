import { KaizenMark, SectionTag } from "@/components/Brand";
import { CatalogCard } from "@/components/catalog/CatalogCard";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useStarterCatalog } from "@/hooks/use-panel";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Cable,
  Check,
  Cpu,
  FileCode,
  Layers,
  Link2,
  MessagesSquare,
  QrCode,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

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

const API_SAMPLE = `curl -X POST https://your-panel.dev/v1/message/send \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "6281234567890",
    "type": "text",
    "body": "Your order is on its way"
  }'`;

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const featured = useQuery(api.catalog.featuredItems, {});
  const createInquiry = useMutation(api.community.createInquiry);
  useStarterCatalog(featured?.length);

  const panelHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await createInquiry({
        name,
        email,
        subject: "Hello from the home page",
        message,
      });
      setName("");
      setEmail("");
      setMessage("");
      toast.success("Message sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[820px] opacity-70" />
      <div className="screentone pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-25" />
      <div className="ash-mist pointer-events-none absolute inset-x-0 top-0 h-[720px]" />

      <SiteHeader />

      {/* ================= Hero ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SectionTag tone="ember">Wangsap-style API</SectionTag>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              <span className="gradient-text text-glow">Anime Baileys</span>
              <br />
              Panel
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              A self-hosted WhatsApp automation panel in the WangSAP mould. Link
              your numbers, run blasts, answer messages on autopilot, and drive
              it all from one console — no rented numbers, no shared gateway,
              no monthly bill from someone else&apos;s server.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" asChild>
                <Link to={panelHref}>
                  <Zap className="size-4" />
                  {isAuthenticated ? "Open your panel" : "Start free"}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/catalog">
                  <Sparkles className="size-4" />
                  Browse the catalog
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
                { k: "Pairing", v: "QR or code" },
                { k: "Sending", v: "Full Baileys" },
                { k: "Ownership", v: "Yours" },
              ].map((stat) => (
                <div key={stat.k} className="stat-chip px-3 py-3">
                  <dt className="text-[9px] font-bold uppercase tracking-[0.2em] text-mist">
                    {stat.k}
                  </dt>
                  <dd className="mt-1 font-display text-sm font-bold">
                    {stat.v}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Floating console */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative"
          >
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-ember/10 blur-3xl" />
            <div className="app-frame relative rounded-2xl">
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
              <div className="holo-border flex items-center gap-2 rounded-xl px-3 py-2 shadow-[0_18px_40px_-20px_oklch(0_0_0/90%)]">
                <Radio className="size-4 text-ember" />
                <span className="text-[11px] font-semibold">2 devices online</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= What it is ================= */}
      <section className="relative z-10 border-y border-border/50 bg-abyss/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <SectionTag tone="ash">What this is</SectionTag>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              The WangSAP model, without{" "}
              <span className="gradient-text">the middleman.</span>
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Wangsap made bulk WhatsApp messaging easy by renting you access
              to numbers you never owned. This does the same job with a socket
              you started yourself: the same blast queues, the same auto-reply
              rules, the same webhooks — pointed at hardware you control.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: QrCode,
                title: "QR and code pairing",
                body: "Scan the ref from WhatsApp, or request an eight-digit pairing code when the camera is the wrong tool.",
                tone: "neon" as const,
              },
              {
                icon: Terminal,
                title: "A console that streams",
                body: "connection.update, creds.update, messages.upsert, receipts — every event as it happens, colour-coded by level.",
                tone: "holo" as const,
              },
              {
                icon: Send,
                title: "The whole send surface",
                body: "Text, image, video, audio, file, sticker, poll, location and contact — the complete BaileysClass API from one composer.",
                tone: "sakura" as const,
              },
              {
                icon: Cpu,
                title: "Fleet telemetry",
                body: "Per-device CPU and memory with a 24-hour traffic history, so a flapping socket is obvious before anyone complains.",
                tone: "mint" as const,
              },
              {
                icon: Webhook,
                title: "Event fan-out",
                body: "Point any endpoint at connection, message, receipt or credential events. Signed, retried, and counted per endpoint.",
                tone: "neon" as const,
              },
              {
                icon: ShieldCheck,
                title: "Your credentials, your box",
                body: "Sessions belong to an account. API keys are hashed at rest, and admin access is a separate door entirely.",
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
        </div>
      </section>

      {/* ================= Catalog preview ================= */}
      {(featured ?? []).length > 0 && (
        <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <SectionTag tone="ember">Catalog</SectionTag>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Installable pieces,{" "}
                <span className="gradient-text">not subscriptions.</span>
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Each entry is something you drop onto your own deployment —
                blast runners, reply packs, the webhook bridge. Read what it
                does before you take it.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/catalog">
                See all entries
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(featured ?? []).map((item, i) => (
              <CatalogCard key={item._id} item={item} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ================= Workflow ================= */}
      <section className="relative z-10 border-y border-border/50 bg-abyss/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionTag tone="sakura">Workflow</SectionTag>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                From nothing to sending
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
                    body: "Scan the QR ref or type the pairing code. On success the socket reports connection: open and the exact JID it logged in as.",
                  },
                  {
                    n: "03",
                    icon: MessagesSquare,
                    title: "Answer traffic",
                    body: "Inbound events land in the console and the message inbox. Dispatch replies from the composer, or hand everything to a webhook.",
                  },
                  {
                    n: "04",
                    icon: FileCode,
                    title: "Install an egg",
                    body: "An egg lays a whole agent onto the session — scripts, manifests, config — then wings boots it with a live socket already in scope.",
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <span className="clip-shuriken flex size-11 shrink-0 items-center justify-center border border-ember/40 bg-ember/10 text-ember">
                        <step.icon className="size-4" />
                      </span>
                      <span className="mt-2 w-px flex-1 bg-gradient-to-b from-edge to-transparent" />
                    </div>
                    <div className="pb-2">
                      <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-ember">
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

            <div className="space-y-5">
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

bot.on("ready", () => console.log("READY BOT"));

bot.on("message", async (message) => {
  await bot.sendPoll(message.from, "Pick one", {
    options: ["text", "media", "sticker"],
    multiselect: false,
  });
});`}</code>
                </pre>
              </div>

              <div className="slab overflow-hidden">
                <div className="border-b border-border/70 px-4 py-3 font-mono text-[11px] text-mist">
                  send a message
                </div>
                <pre className="well m-3 overflow-x-auto p-4 text-[11px] leading-relaxed text-neon">
                  <code>{API_SAMPLE}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Stack + booking ================= */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Layers, k: "Protocol", v: "Baileys 6.x", d: "The WhatsApp multi-device library, unmodified." },
            { icon: Zap, k: "Realtime", v: "Convex", d: "Subscriptions push socket state the moment it changes." },
            { icon: Terminal, k: "Interface", v: "React + Vite", d: "Typed end to end, with shadcn primitives underneath." },
            { icon: ShieldCheck, k: "Access", v: "Convex Auth", d: "Account-scoped sessions, plus a separate admin door." },
          ].map((item, i) => (
            <motion.div
              key={item.k}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="slab p-5"
            >
              <item.icon className="size-5 text-ember" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.22em] text-mist">
                {item.k}
              </p>
              <p className="mt-1 font-display text-lg font-bold">{item.v}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.d}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Booking */}
          <div className="slab flex flex-col p-7">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="size-5 text-ember" />
              <h2 className="font-display text-xl font-bold">
                Need a hand setting up?
              </h2>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              Book a half hour. We will walk through your migration, chase down a
              number that will not hold a connection, or work out why a
              campaign stopped halfway. Confirmed by email.
            </p>
            <div className="mt-6 flex items-center gap-4 text-xs text-mist">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-neon" />
                30 minutes
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-neon" />
                Your timezone
              </span>
            </div>
            <Button className="mt-6" asChild>
              <Link to="/book">
                Book a slot
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {/* Contact */}
          <form onSubmit={sendMessage} className="slab flex flex-col p-7">
            <h2 className="font-display text-xl font-bold">Or just say hello</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Goes straight to the inbox. No account needed.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-name">Name</Label>
                <Input
                  id="l-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-email">Email</Label>
                <Input
                  id="l-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Label htmlFor="l-message">Message</Label>
              <Textarea
                id="l-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you need?"
                className="min-h-24"
              />
            </div>
            <Button type="submit" variant="outline" className="mt-4" disabled={sending}>
              {sending ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative z-10 px-5 pb-24 sm:px-8">
        <div className="app-frame relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-14">
          <div className="anime-grid absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.6_0.16_235/28%),transparent)]" />

          <div className="relative">
            <div className="sigil mx-auto size-20">
              <KaizenMark size={44} />
            </div>
            <h2 className="mt-8 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <span className="gradient-text text-glow">Link one number.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
              Provision a session, scan the code, and watch the socket come up.
              Install an egg when you want an agent doing the work.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to={panelHref}>
                  {isAuthenticated ? "Open your panel" : "Create an account"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/eggs">Browse the eggs</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/docs">Read the docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-mist">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="well h-1.5 overflow-hidden rounded-full p-[1.5px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon to-holo shadow-[0_0_8px_oklch(0.78_0.16_210/70%)]"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
