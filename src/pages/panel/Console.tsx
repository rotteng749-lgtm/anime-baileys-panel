import { StatusPill } from "@/components/Brand";
import { CpuMeter, EmptyState, MemMeter, PairingCode, QrBlock } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  usePanelActions,
  useRuntimeLoop,
  useSessionLogs,
  useSessionMessages,
  useSessions,
} from "@/hooks/use-panel";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Cable,
  ChevronDown,
  Link2,
  PlugZap,
  Power,
  RefreshCw,
  Send,
  Terminal,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<string, string> = {
  info: "text-sky-200",
  success: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-rose-300",
  debug: "text-mist",
  command: "text-neon font-semibold",
};

export default function Console() {
  const sessions = useSessions();
  const [params, setParams] = useSearchParams();
  const selected = params.get("session") ?? undefined;

  const active =
    (sessions ?? []).find((s) => s._id === selected) ?? (sessions ?? [])[0];
  const activeId = active?._id;

  useRuntimeLoop(sessions);
  const logs = useSessionLogs(activeId);
  const messages = useSessionMessages(activeId);
  const {
    startPairing,
    regenerate,
    completePairing,
    disconnect,
    deleteSession,
    sendMessage,
    receiveMessage,
    setAutoReply,
    updateConfig,
  } = usePanelActions();

  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest line in view, the way a terminal does.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const online = active?.status === "connected";

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !to.trim() || !body.trim()) return;
    setSending(true);
    try {
      await sendMessage({ sessionId: activeId, to: to.trim(), body: body.trim() });
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if ((sessions ?? []).length === 0) {
    return (
      <div>
        <PageHead
          eyebrow="Runtime"
          title="Console"
          description="Stream a device's socket output, pair it, and dispatch messages without leaving the panel."
        />
        <EmptyState
          icon={Terminal}
          title="Nothing to attach to"
          description="Provision a session first — the console attaches to that device's socket and shows every Baileys event in real time."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHead
        eyebrow="Runtime"
        title="Console"
        description="Stream a device's socket output, pair it, and dispatch messages without leaving the panel."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeId ?? ""}
                onChange={(e) => setParams({ session: e.target.value })}
                className="h-10 appearance-none rounded-lg border border-edge bg-gradient-to-b from-surface-3 to-surface pr-9 pl-3.5 text-sm font-semibold shadow-[inset_0_1px_0_oklch(1_0_0/16%),0_3px_0_oklch(0.16_0.05_264)] outline-none"
              >
                {(sessions ?? []).map((s) => (
                  <option key={s._id} value={s._id} className="bg-surface">
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-mist" />
            </div>
            {active && <StatusPill status={active.status} />}
          </div>
        }
      />

      {active && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ---- Left: pairing + controls ---- */}
          <div className="space-y-5">
            <PairingPanel
              session={active}
              onStart={() => startPairing({ sessionId: active._id })}
              onRegenerate={() => regenerate({ sessionId: active._id })}
              onComplete={() => completePairing({ sessionId: active._id })}
            />

            <div className="slab p-5">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                Runtime
              </h3>
              <div className="mt-4 space-y-3">
                <CpuMeter cpu={active.cpu} />
                <MemMeter memoryMb={active.memoryMb} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => receiveMessage({ sessionId: active._id })}
                  title="Simulate an inbound messages.upsert event"
                >
                  <ArrowDownLeft className="size-3" />
                  Inbound
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!online}
                  onClick={() => disconnect({ sessionId: active._id })}
                >
                  <Power className="size-3" />
                  Stop
                </Button>
              </div>
            </div>

            <div className="slab space-y-4 p-5">
              <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                Behaviour
              </h3>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="auto-reply" className="text-sm">
                  Auto-reply
                </Label>
                <Switch
                  id="auto-reply"
                  checked={active.autoReply ?? false}
                  onCheckedChange={(v) =>
                    setAutoReply({ sessionId: active._id, enabled: v })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix" className="text-sm">
                  Reply prefix
                </Label>
                <Input
                  id="prefix"
                  defaultValue={active.prefix ?? ""}
                  placeholder="Kaizen Bot"
                  onBlur={(e) =>
                    updateConfig({ sessionId: active._id, prefix: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook" className="text-sm">
                  Event webhook
                </Label>
                <Input
                  id="webhook"
                  defaultValue={active.webhookUrl ?? ""}
                  placeholder="https://api.example.com/wa"
                  onBlur={(e) =>
                    updateConfig({
                      sessionId: active._id,
                      webhookUrl: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  void deleteSession({ sessionId: active._id });
                  toast.success("Session deleted");
                }}
              >
                <Trash2 className="size-3" />
                Delete session
              </Button>
            </div>
          </div>

          {/* ---- Right: logs + composer ---- */}
          <div className="space-y-5 lg:col-span-2">
            <div className="slab overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-400/80" />
                  <span className="size-2 rounded-full bg-amber-300/80" />
                  <span className="size-2 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 font-mono text-[11px] text-mist">
                    {active.name} — baileys socket
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-widest",
                    online ? "text-emerald-300" : "text-mist",
                  )}
                >
                  {online ? "streaming" : "idle"}
                </span>
              </div>

              <div
                ref={logRef}
                className="well m-3 h-[340px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed"
              >
                <AnimatePresence initial={false}>
                  {(logs ?? []).map((line) => (
                    <motion.div
                      key={line._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3"
                    >
                      <span className="shrink-0 text-mist/60">
                        {new Date(line.createdAt).toLocaleTimeString([], {
                          hour12: false,
                        })}
                      </span>
                      <span className={cn("min-w-0 break-all", LEVEL_STYLE[line.level])}>
                        {line.message}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {(logs ?? []).length === 0 && (
                  <p className="text-mist">Waiting for socket output…</p>
                )}
              </div>
            </div>

            <div className="slab p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                  Dispatch
                </h3>
                <span className="font-mono text-[10px] text-mist">
                  sendText(jid, body)
                </span>
              </div>
              <form onSubmit={onSend} className="space-y-3">
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="6281234567890 or 6281234567890@s.whatsapp.net"
                  disabled={!online}
                />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={online ? "Type the message body…" : "Link the device to send"}
                  disabled={!online}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={!online || sending}>
                    <Send className="size-4" />
                    {sending ? "Sending…" : "Send message"}
                  </Button>
                </div>
              </form>

              <div className="mt-5 border-t border-border/60 pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-mist">
                  Recent on this socket
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {(messages ?? []).slice(0, 12).map((m) => (
                    <div key={m._id} className="flex items-start gap-2 text-xs">
                      {m.direction === "inbound" ? (
                        <ArrowDownLeft className="mt-0.5 size-3 shrink-0 text-holo" />
                      ) : (
                        <ArrowUpRight className="mt-0.5 size-3 shrink-0 text-neon" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{m.body}</span>
                      <span className="shrink-0 font-mono text-[10px] text-mist">
                        {m.status}
                      </span>
                    </div>
                  ))}
                  {(messages ?? []).length === 0 && (
                    <p className="text-xs text-mist">No messages yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The pairing handshake: QR ref, pairing code, and the link action. */
function PairingPanel({
  session,
  onStart,
  onRegenerate,
  onComplete,
}: {
  session: {
    _id: string;
    status: string;
    pairMethod: "qr" | "code";
    qrPayload?: string;
    pairingCode?: string;
    pairingExpiresAt?: number;
    jid?: string;
  };
  onStart: () => void;
  onRegenerate: () => void;
  onComplete: () => void;
}) {
  const waiting = session.status === "awaiting_pairing";
  const connecting = session.status === "connecting";
  const online = session.status === "connected";

  return (
    <div className="slab p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
          Pairing
        </h3>
        {waiting && (
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-1 text-[10px] font-semibold text-neon hover:text-holo"
          >
            <RefreshCw className="size-3" />
            refresh
          </button>
        )}
      </div>

      {online ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
          <Link2 className="size-5 shrink-0 text-emerald-300" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-200">Device linked</p>
            <p className="truncate font-mono text-[10px] text-emerald-300/80">
              {session.jid}
            </p>
          </div>
        </div>
      ) : (
        <>
          {session.pairMethod === "qr" ? (
            <div className="mt-4 flex justify-center">
              {waiting && session.qrPayload ? (
                <QrBlock payload={session.qrPayload} />
              ) : (
                <div className="well flex size-[208px] flex-col items-center justify-center gap-2 p-4 text-center">
                  <PlugZap className="size-8 text-mist" />
                  <p className="text-[11px] text-mist">
                    {connecting ? "Negotiating…" : "Socket is closed"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4">
              {waiting && session.pairingCode ? (
                <>
                  <PairingCode code={session.pairingCode} />
                  <p className="mt-3 text-center text-[11px] text-mist">
                    WhatsApp → Linked devices → Link with phone number
                  </p>
                </>
              ) : (
                <div className="well flex h-[104px] items-center justify-center text-[11px] text-mist">
                  {connecting ? "Requesting a code…" : "Socket is closed"}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 space-y-2">
            {waiting ? (
              <Button className="w-full" onClick={onComplete}>
                <Cable className="size-4" />
                Mark device as linked
              </Button>
            ) : (
              <Button
                className="w-full"
                variant={connecting ? "outline" : "default"}
                disabled={connecting}
                onClick={onStart}
              >
                <PlugZap className="size-4" />
                {connecting ? "Connecting…" : "Start pairing"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
