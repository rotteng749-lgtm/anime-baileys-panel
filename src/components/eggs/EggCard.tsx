import { SectionTag } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { Box, Download, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { ACCENT_STYLES, type AccentKey } from "@/components/catalog/CatalogCard";

/** An egg card: the manifest's headline, its runtime, and its install count. */
export function EggCard({
  egg,
  index = 0,
}: {
  egg: {
    slug: string;
    name: string;
    description: string;
    category: string;
    runtime: string;
    tags: string[];
    accent: string;
    installs: number;
    author: string;
    status: string;
    official: boolean;
  };
  index?: number;
}) {
  const accent =
    ACCENT_STYLES[(egg.accent as AccentKey) in ACCENT_STYLES
      ? (egg.accent as AccentKey)
      : "neon"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3) }}
    >
      <Link
        to={`/eggs/${egg.slug}`}
        className={cn(
          "slab group flex h-full flex-col p-6 transition-all duration-200 hover:-translate-y-1.5",
          accent.glow,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <SectionTag tone={accent.tag}>{egg.category}</SectionTag>
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br to-transparent",
              accent.ring,
              accent.plate,
            )}
          >
            <Box className="size-4" />
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <h3 className="truncate font-display text-xl font-bold tracking-tight">
            {egg.name}
          </h3>
          {egg.official && (
            <span title="Ships with the panel">
              <ShieldCheck className="size-3.5 shrink-0 text-neon" />
            </span>
          )}
          {egg.status === "pending" && (
            <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ember">
              pending
            </span>
          )}
        </div>

        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {egg.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded border border-edge bg-abyss/60 px-2 py-0.5 font-mono text-[10px] text-mist">
            {egg.runtime}
          </span>
          {egg.tags.slice(0, 3).map((tag) => (
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
            {egg.installs} installs
          </span>
          <span className="truncate pl-2">{egg.author}</span>
        </div>
      </Link>
    </motion.div>
  );
}
