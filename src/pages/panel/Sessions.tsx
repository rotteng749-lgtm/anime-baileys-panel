import { StatusPill } from "@/components/Brand";
import { NewSessionForm } from "@/components/panel/NewSessionForm";
import { CpuMeter, EmptyState, MemMeter } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { usePanelActions, useRuntimeLoop, useSessions } from "@/hooks/use-panel";
import { motion } from "framer-motion";
import { Cable, ExternalLink, Power, Smartphone, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Sessions() {
  const sessions = useSessions();
  const { startPairing, disconnect, deleteSession } = usePanelActions();
  useRuntimeLoop(sessions);

  const list = sessions ?? [];

  return (
    <div>
      <PageHead
        eyebrow="Fleet"
        title="Sessions"
        description="One entry per linked number. Each holds its own creds, socket state and console stream."
        actions={<NewSessionForm />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="The fleet is empty"
          description="Provision your first session to open a Baileys socket and pair a WhatsApp device."
          action={<NewSessionForm />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((session, i) => (
            <motion.div
              key={session._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="slab flex flex-col p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-bold">
                    {session.name}
                  </h3>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-mist">
                    {session.jid ?? session.phone ?? "awaiting pairing"}
                  </p>
                </div>
                <StatusPill status={session.status} />
              </div>

              <div className="mt-4 space-y-2.5">
                <CpuMeter cpu={session.cpu} />
                <MemMeter memoryMb={session.memoryMb} />
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "Sent", v: session.messagesSent, tone: "text-neon" },
                  { k: "Recv", v: session.messagesReceived, tone: "text-holo" },
                  {
                    k: "Method",
                    v: session.pairMethod === "qr" ? "QR" : "Code",
                    tone: "text-foreground",
                  },
                ].map((cell) => (
                  <div key={cell.k} className="stat-chip px-2 py-2">
                    <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-mist">
                      {cell.k}
                    </dt>
                    <dd className={cn("mt-0.5 font-mono text-sm font-bold", cell.tone)}>
                      {cell.v}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button size="sm" asChild>
                  <Link to={`/panel/console?session=${session._id}`}>
                    <ExternalLink className="size-3" />
                    Console
                  </Link>
                </Button>
                {session.status === "connected" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void disconnect({ sessionId: session._id });
                      toast.success("Socket stopped");
                    }}
                  >
                    <Power className="size-3" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void startPairing({ sessionId: session._id });
                      toast.success("Opening socket…");
                    }}
                  >
                    <Cable className="size-3" />
                    Pair
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-rose-300 hover:bg-rose-500/10"
                  onClick={() => {
                    void deleteSession({ sessionId: session._id });
                    toast.success("Session deleted");
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
