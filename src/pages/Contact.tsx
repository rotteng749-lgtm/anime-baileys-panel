import { SectionTag } from "@/components/Brand";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

const SUBJECTS = [
  "A question about an entry",
  "Reporting a problem",
  "Migration help",
  "Something else",
];

export default function Contact() {
  const send = useMutation(api.community.createInquiry);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await send({ name, email, subject, message });
      setSent(true);
      toast.success("Message sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[320px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-xl"
        >
          <SectionTag tone="ember">Contact</SectionTag>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Send a message.
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            A question about an entry, a number that will not hold a
            connection, or a campaign that needs pacing. It lands straight in
            the admin inbox.
          </p>
        </motion.div>

        {sent ? (
          <div className="slab mt-10 p-10 text-center">
            <div className="sigil mx-auto size-16">
              <Check className="size-6 text-neon" />
            </div>
            <h2 className="mt-6 font-display text-xl font-bold">Message sent</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It is in the inbox. Expect a reply at {email}.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setSent(false);
                setMessage("");
              }}
            >
              Send another
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="slab mt-10 space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-name">Name</Label>
                <Input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Who is this from?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-subject">Subject</Label>
              <select
                id="c-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-gradient-to-b from-abyss/70 to-abyss/40 px-3.5 text-sm outline-none"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} className="bg-surface">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-message">Message</Label>
              <Textarea
                id="c-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What do you need?"
                className="min-h-40"
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send message
                </>
              )}
            </Button>
          </form>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
