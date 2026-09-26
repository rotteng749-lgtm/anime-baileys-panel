import { StatusPill } from "@/components/Brand";
import { NewSessionForm } from "@/components/panel/NewSessionForm";
import { CpuMeter, EmptyState, MemMeter, StatTile } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  useActivity,
  usePanelActions,
  useRecentMessages,
  useSessions,
} from "@/hooks/use-panel";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarClock,
  FileStack,
  Radio,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";

/**
 * The member dashboard — the first thing you see after signing in.
 *
 * Devices lead, because that is what the panel is for, but your own posts and
 * bookings sit right underneath so the account is not just a socket list.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const sessions = useSessions();
  const activity = useActivity();
  const recent = useRecentMessages(6);
  const myPosts = useQuery(api.community.myPosts, {});
  const myBookings = useQuery(api.bookings.myBookings, {});
  const { power } = usePanelActions();

  const totals = activity?.totals;
  const online = sessions?.filter((s) => s.status === "connected") ?? [];
  const pendingBookings =
    myBookings?.filter((b) => b.status === "pending").length ?? 0;

  return (
    <div>
      <PageHead
        eyebrow="Your account"
        title={user?.name ? `Welcome back, ${user.name}` : "Your dashboard"}
        description="Your linked devices, the traffic they carry, and everything you have published or booked."
        actions={<NewSessionForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Devices online"
          value={online.length}
          hint={`${sessions?.length ?? 0} linked`}
          icon={Radio}
          tone="mint"
        />
        <StatTile
          label="Sent"
          value={(totals?.sent ?? 0).toLocaleString()}
          hint="across all devices"
          icon={ArrowUpRight}
          tone="neon"
        />
        <StatTile
          label="Received"
          value={(totals?.received ?? 0).toLocaleString()}
          hint="inbound events"
          icon={ArrowDownLeft}
          tone="holo"
        />
        <StatTile
          label="Your posts"
          value={myPosts?.length ?? 0}
          hint={pendingBookings ? `${pendingBookings} booking pending` : "nothing pending"}
          icon={FileStack}
          tone="sakura"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Devices */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
              Your devices
            </h2>
            <Link
              to="/dashboard/sessions"
              className="text-xs font-semibold text-neon transition-colors hover:text-ember"
            >
              Manage →
            </Link>
          </div>

          {(sessions ?? []).length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No devices yet"
              description="Link a number to start sending. Pairing takes a QR scan or an eight-digit code."
              action={<NewSessionForm />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(sessions ?? []).map((session, i) => (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link
                    to={`/dashboard/console?session=${session._id}`}
                    className="slab group block p-5 transition-transform duration-200 hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold">
                          {session.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-mist">
                          {session.jid ?? session.phone ?? "not linked yet"}
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
                              void power({ sessionId: session._id, action: "start" });
                            }}
                          >
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

        <div className="space-y-6">
          {/* Bookings */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
                Your bookings
              </h2>
              <Link
                to="/dashboard/bookings"
                className="text-xs font-semibold text-neon transition-colors hover:text-ember"
              >
                All →
              </Link>
            </div>
            {(myBookings ?? []).length === 0 ? (
              <div className="slab p-5 text-sm text-muted-foreground">
                Nothing booked.{" "}
                <Link to="/book" className="font-semibold text-neon">
                  Find a slot →
                </Link>
              </div>
            ) : (
              <div className="well divide-y divide-white/5">
                {(myBookings ?? []).slice(0, 3).map((b) => (
                  <div key={b._id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">
                        {b.date} · {b.slot}
                      </span>
                      <BookingBadge status={b.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {b.topic}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Posts */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
                Your posts
              </h2>
              <Link
                to="/dashboard/posts"
                className="text-xs font-semibold text-neon transition-colors hover:text-ember"
              >
                Write →
              </Link>
            </div>
            {(myPosts ?? []).length === 0 ? (
              <div className="slab p-5 text-sm text-muted-foreground">
                You have not published anything yet.{" "}
                <Link to="/dashboard/posts" className="font-semibold text-neon">
                  Write a post →
                </Link>
              </div>
            ) : (
              <div className="well divide-y divide-white/5">
                {(myPosts ?? []).slice(0, 3).map((p) => (
                  <div key={p._id} className="px-4 py-3">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="mt-0.5 text-[11px] text-mist">
                      {p.kind} · {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Latest traffic */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
            Latest traffic
          </h2>
          <Link
            to="/dashboard/messages"
            className="flex items-center gap-1 text-xs font-semibold text-neon transition-colors hover:text-ember"
          >
            Open inbox <ArrowRight className="size-3" />
          </Link>
        </div>
        {(recent ?? []).length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No traffic yet"
            description="Link a device and the message log fills up as conversations come in."
          />
        ) : (
          <div className="well divide-y divide-white/5">
            {(recent ?? []).map((m) => (
              <div key={m._id} className="flex items-center gap-3 px-4 py-3">
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
                <p className="min-w-0 flex-1 truncate text-sm">{m.body}</p>
                <span className="shrink-0 font-mono text-[10px] text-mist">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BookingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-ember/40 bg-ember/10 text-ember",
    confirmed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    cancelled: "border-edge bg-white/5 text-mist",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        map[status] ?? map.cancelled
      }`}
    >
      {status}
    </span>
  );
}
