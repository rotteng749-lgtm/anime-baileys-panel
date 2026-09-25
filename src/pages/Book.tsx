import { SectionTag } from "@/components/Brand";
import { EmptyState } from "@/components/panel/Parts";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const TOPICS = [
  "Migrating a bot onto this panel",
  "A number that keeps dropping",
  "Blast pacing and rate limits",
  "Webhook integration",
  "Something else",
];

export default function Book() {
  const availability = useQuery(api.bookings.listAvailability, {});
  const createBooking = useMutation(api.bookings.createBooking);
  const { user, isAuthenticated } = useAuth();

  const [date, setDate] = useState<string | undefined>();
  const [slot, setSlot] = useState<string | undefined>();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const day = (availability ?? []).find((d) => d.date === date);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !slot) {
      toast.error("Pick a day and a time first");
      return;
    }
    setSending(true);
    try {
      await createBooking({
        name,
        email,
        date,
        slot,
        topic,
        notes: notes || undefined,
      });
      toast.success("Requested — you will get a confirmation by email");
      setSlot(undefined);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book that slot");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <SectionTag tone="ember">Schedule</SectionTag>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Book a half hour.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            One operator, one calendar. Pick a slot and tell me what it is
            about — a migration, a number that will not stay connected, a
            campaign that needs pacing. Requests are confirmed by email.
          </p>
        </motion.div>

        <form onSubmit={submit} className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <div className="slab p-6">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                Pick a day
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(availability ?? []).map((d) => {
                  const full = d.slots.length === 0;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      disabled={full}
                      onClick={() => {
                        setDate(d.date);
                        setSlot(undefined);
                      }}
                      className={cn(
                        "w-[72px] rounded-lg border px-2 py-2.5 text-center transition-all",
                        date === d.date
                          ? "border-neon/60 bg-neon/12 text-foreground shadow-[0_0_18px_-6px_oklch(0.78_0.16_200/80%)]"
                          : full
                            ? "cursor-not-allowed border-edge/40 text-mist/50"
                            : "border-edge text-muted-foreground hover:border-edge-strong hover:text-foreground",
                      )}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {d.weekday}
                      </span>
                      <span className="mt-0.5 block font-display text-sm font-bold">
                        {new Date(`${d.date}T12:00:00`).getDate()}
                      </span>
                      <span className="mt-0.5 block text-[9px] opacity-60">
                        {full ? "full" : `${d.slots.length} free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="slab p-6">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                Pick a time
              </h2>
              {!date ? (
                <p className="mt-4 text-sm text-mist">Choose a day first.</p>
              ) : day === undefined || day.slots.length === 0 ? (
                <p className="mt-4 text-sm text-mist">
                  That day is fully booked — try another.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {day.slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 font-mono text-sm font-semibold transition-all",
                        slot === s
                          ? "border-ember/60 bg-ember/12 text-ember ember-glow"
                          : "border-edge text-muted-foreground hover:border-edge-strong hover:text-foreground",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="slab space-y-4 p-6">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                Details
              </h2>

              <div className="space-y-2">
                <Label htmlFor="book-name">Name</Label>
                <Input
                  id="book-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Who is this for?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-email">Email</Label>
                <Input
                  id="book-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-topic">What is it about?</Label>
                <select
                  id="book-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-gradient-to-b from-abyss/70 to-abyss/40 px-3.5 text-sm outline-none"
                >
                  {TOPICS.map((t) => (
                    <option key={t} value={t} className="bg-surface">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-notes">Anything else?</Label>
                <Textarea
                  id="book-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Numbers, error text, what you have already tried…"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={sending || !date || !slot}
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Requesting…
                  </>
                ) : (
                  <>
                    <CalendarClock className="size-4" />
                    {date && slot ? `Request ${slot} on ${date}` : "Request a slot"}
                  </>
                )}
              </Button>

              {!isAuthenticated && (
                <p className="text-center text-[11px] text-mist">
                  Signed in, this also appears on your dashboard.
                </p>
              )}
            </div>

            {availability !== undefined && availability.length === 0 && (
              <EmptyState
                icon={CalendarClock}
                title="No open days"
                description="Every slot in the next three weeks is taken."
              />
            )}
          </div>
        </form>

        <div className="mt-10 flex items-center gap-3 rounded-xl border border-edge/60 bg-abyss/40 px-5 py-4">
          <Check className="size-4 shrink-0 text-neon" />
          <p className="text-xs text-muted-foreground">
            Requests are confirmed from the admin area. Times are local, and
            each slot is thirty minutes.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
