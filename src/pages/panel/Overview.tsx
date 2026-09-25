import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/panel/Shell";
import { CpuMeter, EmptyState, MemMeter, StatTile } from "@/components/panel/Parts";
import { StatusPill } from "@/components/Brand";
import {
  useActivity,
  usePanelActions,
  useRecentMessages,
  useRuntimeLoop,
  useSessions,
} from "@/hooks/use-panel";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Cable,
  Gauge,
  MessagesSquare,
  Radio,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { NewSessionForm } from "@/components/panel/NewSessionForm";

export default function Overview() {
  const sessions = useSessions();
  const activity = useActivity();
  const recent = useRecentMessages(8);
  const { startPairing } = usePanelActions();
  useRuntimeLoop(sessions);

  const totals = activity?.totals;

  return (
    <div>
      <PageHead
        eyebrow="Control deck"
        title="Overview"
        description="Every WhatsApp device linked through Baileys, with live socket state, load and message flow."
        actions={<NewSessionForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Sessions online"
          value={totals?.online ?? 0}
          hint={`${totals?.sessions ?? 0} provisioned`}
          icon={Radio}
          tone="mint"
        />
        <StatTile
          label="Messages sent"
          value={(totals?.sent ?? 0).toLocaleString()}
          hint="lifetime, all sessions"
          icon={ArrowUpRight}
          tone="neon"
        />
        <StatTile
          label="Messages received"
          value={(totals?.received ?? 0).toLocaleString()}
          hint="via messages.upsert"
          icon={ArrowDownLeft}
          tone="holo"
        />
        <StatTile
          label="Fleet load"
          value={`${Math.round(
            (sessions ?? []).reduce((sum, s) => sum + s.cpu, 0) /
              Math.max(1, (sessions ?? []).length),
          )}%`}
          hint="mean CPU across sockets"
          icon={Gauge}
          tone="sakura"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <TrafficChart />
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
              Linked devices
            </h2>
            <Link
              to="/panel/sessions"
              className="text-xs font-semibold text-neon transition-colors hover:text-holo"
            >
              Manage all →
            </Link>
          </div>

          {(sessions ?? []).length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No devices linked yet"
              description="Provision a session to open a Baileys socket and pair a WhatsApp number with a QR code or an 8-digit pairing code."
              action={<NewSessionForm />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(sessions ?? []).slice(0, 4).map((session, i) => (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link
                    to={`/panel/console?session=${session._id}`}
                    className="slab group block p-5 transition-transform duration-200 hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold">
                          {session.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-mist">
                          {session.jid ?? session.phone ?? "no number yet"}
                        </p>
                      </div>
                      <StatusPill status={session.status} />
                    </div>

                    <div className="mt-4 space-y-2.5">
                      <CpuMeter cpu={session.cpu} />
                      <MemMeter memoryMb={session.memoryMb} />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-mist">
                      <span className="flex items-center gap-1.5">
                        <ArrowUpRight className="size-3 text-neon" />
                        {session.messagesSent}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ArrowDownLeft className="size-3 text-holo" />
                        {session.messagesReceived}
                      </span>
                      {session.status !== "connected" &&
                        session.status !== "connecting" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              void startPairing({ sessionId: session._id });
                              toast.success("Opening socket…");
                            }}
                          >
                            <Cable className="size-3" />
                            Pair
                          </Button>
                        )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
            Latest traffic
          </h2>
          <Link
            to="/panel/messages"
            className="text-xs font-semibold text-neon transition-colors hover:text-holo"
          >
            Open inbox →
          </Link>
        </div>
        <MessageFeed messages={recent ?? []} />
      </div>
    </div>
  );
}

/** 24-hour inbound/outbound bars, drawn as stacked neon columns. */
function TrafficChart() {
  const activity = useActivity();
  const buckets = activity?.buckets ?? [];
  const peak = Math.max(1, ...buckets.map((b) => b.inbound + b.outbound));

  return (
    <div className="slab h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          Traffic · 24h
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-mist">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-neon" /> out
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-holo" /> in
          </span>
        </div>
      </div>

      <div className="mt-6 flex h-40 items-end gap-[3px]">
        {buckets.length === 0
          ? Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-1 rounded-t bg-white/5" style={{ height: "8%" }} />
            ))
          : buckets.map((b, i) => {
              const total = b.inbound + b.outbound;
              const h = (total / peak) * 100;
              return (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col justify-end"
                  style={{ height: "100%" }}
                >
                  <div
                    className="flex flex-col-reverse overflow-hidden rounded-t transition-all duration-500"
                    style={{ height: `${Math.max(h, 3)}%` }}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-holo/70 to-holo"
                      style={{ height: `${total ? (b.outbound / total) * 100 : 0}%` }}
                    />
                    <div
                      className="w-full bg-gradient-to-t from-neon/60 to-neon"
                      style={{ height: `${total ? (b.inbound / total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-edge bg-abyss px-2 py-1 text-[10px] shadow-lg group-hover:block">
                    {total} msg · {new Date(b.t).getUTCHours()}h
                  </div>
                </div>
              );
            })}
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-mist">
        <span>24h ago</span>
        <span>12h</span>
        <span>now</span>
      </div>
    </div>
  );
}

function MessageFeed({
  messages,
}: {
  messages: Array<{
    _id: string;
    direction: "inbound" | "outbound";
    body: string;
    jid: string;
    pushName?: string;
    kind: string;
    status: string;
    createdAt: number;
    sessionName?: string;
  }>;
}) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No traffic yet"
        description="Once a device is linked, inbound and outbound messages stream here in real time."
      />
    );
  }

  return (
    <div className="well divide-y divide-white/5">
      {messages.map((m) => (
        <div
          key={m._id}
          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
        >
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
              m.direction === "inbound"
                ? "border-holo/30 bg-holo/10 text-holo"
                : "border-neon/30 bg-neon/10 text-neon"
            }`}
          >
            {m.direction === "inbound" ? (
              <ArrowDownLeft className="size-3.5" />
            ) : (
              <ArrowUpRight className="size-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{m.body}</p>
            <p className="truncate font-mono text-[10px] text-mist">
              {m.pushName ?? m.jid}
              {m.sessionName ? ` · ${m.sessionName}` : ""} · {m.kind}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-mist">
            {new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
