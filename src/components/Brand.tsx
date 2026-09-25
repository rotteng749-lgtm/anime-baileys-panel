import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/convex/schema";

/**
 * The panel mark — a crescent sigil over a socket, rendered as an extruded
 * plate so it reads as a physical emblem rather than a flat icon.
 */
export function KaizenMark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-[30%]"
        style={{
          background:
            "linear-gradient(150deg, oklch(0.85 0.16 200) 0%, oklch(0.62 0.2 285) 55%, oklch(0.55 0.2 320) 100%)",
          boxShadow:
            "0 0 22px -4px oklch(0.78 0.16 215 / 70%), inset 0 1px 0 oklch(1 0 0 / 55%), 0 6px 16px -8px oklch(0 0 0 / 90%)",
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6}>
          {/* crescent */}
          <path
            d="M14.6 3.4a8.4 8.4 0 1 0 0 17.2 9.6 9.6 0 0 1 0-17.2Z"
            fill="oklch(0.16 0.05 264)"
            opacity="0.9"
          />
          {/* ember spark at the crescent's tip */}
          <circle cx="18.4" cy="5.6" r="1.5" fill="oklch(0.78 0.18 55)" />
        </svg>
      </span>
    </span>
  );
}

export function KaizenWordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <KaizenMark size={compact ? 30 : 38} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-bold tracking-[0.1em] gradient-text",
            compact ? "text-sm" : "text-base",
          )}
        >
          ANIME BAILEYS
        </span>
        {!compact && (
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.42em] text-ember">
            Panel
          </span>
        )}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status vocabulary                                                  */
/* ------------------------------------------------------------------ */

export const STATUS_META: Record<
  SessionStatus,
  { label: string; dot: string; text: string; ring: string; glow: string }
> = {
  connected: {
    label: "Online",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    ring: "border-emerald-400/40 bg-emerald-400/10",
    glow: "shadow-[0_0_14px_-2px_oklch(0.8_0.17_155/70%)]",
  },
  conflict: {
    label: "Conflict",
    dot: "bg-rose-400",
    text: "text-rose-200",
    ring: "border-rose-400/40 bg-rose-400/10",
    glow: "shadow-[0_0_14px_-2px_oklch(0.7_0.2_20/70%)]",
  },
  connecting: {
    label: "Connecting",
    dot: "bg-sky-300 animate-pulse",
    text: "text-sky-200",
    ring: "border-sky-300/40 bg-sky-300/10",
    glow: "shadow-[0_0_14px_-2px_oklch(0.8_0.14_230/70%)]",
  },
  awaiting_pairing: {
    label: "Awaiting pairing",
    dot: "bg-amber-300 animate-pulse",
    text: "text-amber-200",
    ring: "border-amber-300/40 bg-amber-300/10",
    glow: "shadow-[0_0_14px_-2px_oklch(0.85_0.15_85/65%)]",
  },
  disconnected: {
    label: "Offline",
    dot: "bg-slate-400",
    text: "text-slate-300",
    ring: "border-slate-400/35 bg-slate-400/10",
    glow: "",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        meta.ring,
        meta.text,
        meta.glow,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/** Small uppercase section label with the slanted anime plate. */
export function SectionTag({
  children,
  className,
  tone = "neon",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neon" | "holo" | "sakura" | "ember" | "ash";
}) {
  const tones = {
    neon: "text-neon/90 border-neon/30 bg-neon/8",
    holo: "text-holo/90 border-holo/30 bg-holo/8",
    sakura: "text-sakura/90 border-sakura/30 bg-sakura/8",
    ember: "text-ember/90 border-ember/30 bg-ember/8",
    ash: "text-ash border-ash/30 bg-ash/8",
  };
  return (
    <span
      className={cn(
        "clip-shuriken inline-flex items-center border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
