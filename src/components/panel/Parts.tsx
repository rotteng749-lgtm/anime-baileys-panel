import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Activity, Cpu, MemoryStick } from "lucide-react";
import QRCode from "react-qr-code";

/** Stat tile with a lit top edge, like an instrument readout. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neon",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neon" | "holo" | "sakura" | "mint" | "ember";
}) {
  const glows = {
    neon: "from-neon/25",
    holo: "from-holo/25",
    sakura: "from-sakura/25",
    mint: "from-emerald-400/25",
    ember: "from-ember/25",
  };
  return (
    <div className="slab group relative overflow-hidden p-5">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b to-transparent opacity-70 transition-opacity group-hover:opacity-100",
          glows[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-mist">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-glow">
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-edge bg-gradient-to-br from-surface-3 to-surface text-neon shadow-[inset_0_1px_0_oklch(1_0_0/18%)]">
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Resource meter. The bar is drawn as an extruded channel with a glowing fill,
 * the way a hardware panel renders load.
 */
export function Meter({
  label,
  value,
  max,
  unit,
  icon: Icon = Activity,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon?: LucideIcon;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const hot = pct > 75;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Icon className="size-3" />
          {label}
        </span>
        <span className="font-mono font-semibold text-foreground">
          {Math.round(value)}
          <span className="text-mist">{unit}</span>
        </span>
      </div>
      <div className="well relative h-2.5 overflow-hidden rounded-full p-[2px]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            hot
              ? "bg-gradient-to-r from-amber-400 to-rose-400 shadow-[0_0_10px_oklch(0.7_0.2_20/60%)]"
              : "bg-gradient-to-r from-neon to-holo shadow-[0_0_10px_oklch(0.78_0.16_210/60%)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CpuMeter({ cpu }: { cpu: number }) {
  return <Meter label="CPU" value={cpu} max={100} unit="%" icon={Cpu} />;
}

export function MemMeter({ memoryMb }: { memoryMb: number }) {
  return <Meter label="Memory" value={memoryMb} max={512} unit=" MB" icon={MemoryStick} />;
}

/**
 * The pairing QR.
 *
 * The payload is the exact `ref` string the socket emitted on
 * `connection.update` — nothing here generates or reshapes it — and it is
 * encoded with a real QR encoder, so this is the same matrix WhatsApp writes
 * for a linked-device scan. If the socket has not handed over a ref yet, the
 * panel shows the empty state instead of a decorative code.
 */
export function QrBlock({
  payload,
  className,
  size = 208,
}: {
  payload: string;
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn("well relative overflow-hidden p-3", className)}
      style={{ width: size, height: size }}
    >
      <QRCode
        value={payload}
        size={size - 24}
        level="L"
        bgColor="#f2f7ff"
        fgColor="#0b1533"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-neon/25" />
    </div>
  );
}

/** The typed 8-digit pairing code, shown in a lit monospace plate. */
export function PairingCode({ code }: { code: string }) {
  return (
    <div className="well flex items-center justify-center gap-1 px-5 py-4">
      {code.split("").map((ch, i) =>
        ch === "-" ? (
          <span key={i} className="px-1 text-2xl font-bold text-mist">
            -
          </span>
        ) : (
          <span
            key={i}
            className="flex size-11 items-center justify-center rounded-lg border border-edge bg-gradient-to-b from-surface-3 to-surface font-mono text-2xl font-bold text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/20%),0_3px_0_oklch(0.16_0.05_264)]"
          >
            {ch}
          </span>
        ),
      )}
    </div>
  );
}

/** Empty-state block with a soft glow, used when a list has nothing in it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="slab flex flex-col items-center px-6 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-neon/20 blur-2xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-edge bg-gradient-to-br from-surface-3 to-abyss text-neon">
          <Icon className="size-7" />
        </div>
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
