import { EmptyState } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { useRecentMessages } from "@/hooks/use-panel";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Sticker,
  BarChart3,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  text: MessageCircle,
  image: ImageIcon,
  sticker: Sticker,
  poll: BarChart3,
  location: MapPin,
  contact: Phone,
  file: FileText,
} as const;

type Filter = "all" | "inbound" | "outbound";

export default function Messages() {
  const recent = useRecentMessages(60);
  const [filter, setFilter] = useState<Filter>("all");

  const messages = useMemo(() => {
    const list = recent ?? [];
    return filter === "all" ? list : list.filter((m) => m.direction === filter);
  }, [recent, filter]);

  return (
    <div>
      <PageHead
        eyebrow="Traffic"
        title="Messages"
        description="Every message that crossed a socket, in the order the panel saw it. Inbound arrives via messages.upsert; outbound is what your bot sent."
      />

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "inbound", label: "Inbound" },
            { id: "outbound", label: "Outbound" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "clip-shuriken px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-all",
              filter === tab.id
                ? "bg-gradient-to-b from-neon/90 to-neon/70 text-abyss shadow-[0_3px_0_oklch(0.16_0.05_264)]"
                : "border border-edge text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Nothing on the wire"
          description="Link a device and dispatch a message — or push an inbound event from the console — and it will show up here."
        />
      ) : (
        <div className="well divide-y divide-white/5">
          {messages.map((m, i) => {
            const Icon = KIND_ICON[m.kind as keyof typeof KIND_ICON] ?? MessageCircle;
            const outbound = m.direction === "outbound";
            return (
              <motion.div
                key={m._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]",
                  outbound && "bg-neon/[0.04]",
                )}
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    outbound
                      ? "border-neon/30 bg-neon/10 text-neon"
                      : "border-holo/30 bg-holo/10 text-holo",
                  )}
                >
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">{m.body}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-mist">
                    <span>{m.pushName ?? m.jid}</span>
                    <span>·</span>
                    <span>{m.jid}</span>
                    {m.sessionName && (
                      <>
                        <span>·</span>
                        <span className="text-neon/80">{m.sessionName}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      outbound
                        ? "border-neon/30 text-neon"
                        : "border-holo/30 text-holo",
                    )}
                  >
                    {outbound ? (
                      <ArrowUpRight className="size-2.5" />
                    ) : (
                      <ArrowDownLeft className="size-2.5" />
                    )}
                    {m.direction}
                  </span>
                  <span className="font-mono text-[10px] text-mist">
                    {new Date(m.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
