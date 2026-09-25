import { SectionTag } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { Download, Star } from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";

/**
 * A catalog card.
 *
 * The accent drives the whole card — its tag, its icon plate and its hover
 * glow — so a page full of them reads as a shelf of distinct instruments rather
 * than a uniform list.
 */

export const ACCENT_STYLES = {
  neon: {
    text: "text-neon",
    tag: "neon" as const,
    ring: "border-neon/30",
    plate: "from-neon/25 to-neon/5 text-neon",
    glow: "group-hover:shadow-[0_0_40px_-18px_oklch(0.78_0.16_200/90%)]",
  },
  holo: {
    text: "text-holo",
    tag: "holo" as const,
    ring: "border-holo/30",
    plate: "from-holo/25 to-holo/5 text-holo",
    glow: "group-hover:shadow-[0_0_40px_-18px_oklch(0.68_0.19_300/90%)]",
  },
  sakura: {
    text: "text-sakura",
    tag: "sakura" as const,
    ring: "border-sakura/30",
    plate: "from-sakura/25 to-sakura/5 text-sakura",
    glow: "group-hover:shadow-[0_0_40px_-18px_oklch(0.76_0.15_350/90%)]",
  },
  ember: {
    text: "text-ember",
    tag: "ember" as const,
    ring: "border-ember/30",
    plate: "from-ember/25 to-ember/5 text-ember",
    glow: "group-hover:shadow-[0_0_40px_-18px_oklch(0.72_0.17_45/90%)]",
  },
} as const;

export type AccentKey = keyof typeof ACCENT_STYLES;

export function CatalogCard({
  item,
  index = 0,
}: {
  item: {
    slug: string;
    title: string;
    tagline: string;
    summary: string;
    category: string;
    tags: string[];
    priceLabel: string;
    accent: string;
    installs: number;
    rating: number;
  };
  index?: number;
}) {
  const accent = ACCENT_STYLES[(item.accent as AccentKey) in ACCENT_STYLES ? (item.accent as AccentKey) : "neon"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3) }}
    >
      <Link
        to={`/catalog/${item.slug}`}
        className={cn(
          "slab group flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1.5",
          accent.glow,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <SectionTag tone={accent.tag}>{item.category}</SectionTag>
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br to-transparent",
              accent.ring,
              accent.plate,
            )}
          >
            <Download className="size-4" />
          </span>
        </div>

        <h3 className="mt-5 font-display text-xl font-bold tracking-tight">
          {item.title}
        </h3>
        <p className={cn("mt-1 text-xs font-semibold", accent.text)}>
          {item.tagline}
        </p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {item.summary}
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-edge bg-abyss/50 px-2 py-0.5 font-mono text-[10px] text-mist"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-[11px] text-mist">
          <span className="flex items-center gap-1.5">
            <Download className="size-3" />
            {item.installs.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="size-3 fill-current text-ember" />
            {item.rating.toFixed(1)}
          </span>
          <span className="font-semibold text-foreground">{item.priceLabel}</span>
        </div>
      </Link>
    </motion.div>
  );
}
