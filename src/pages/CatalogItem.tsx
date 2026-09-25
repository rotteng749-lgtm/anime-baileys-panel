import { ACCENT_STYLES, CatalogCard, type AccentKey } from "@/components/catalog/CatalogCard";
import { SectionTag } from "@/components/Brand";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  MessageSquare,
  Star,
  Tag as TagIcon,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function CatalogItem() {
  const { slug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const item = useQuery(api.catalog.getItem, { slug });
  const related = useQuery(api.catalog.relatedItems, { slug });
  const addComment = useMutation(api.catalog.addComment);
  const install = useMutation(api.catalog.installItem);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (item === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-mist" />
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 text-center">
          <h1 className="font-display text-3xl font-bold">That entry is not here</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It may have been unpublished, or the link is mistyped.
          </p>
          <Button variant="outline" className="mt-7" asChild>
            <Link to="/catalog">
              <ArrowLeft className="size-4" />
              Back to the catalog
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const accent = ACCENT_STYLES[(item.accent as AccentKey) in ACCENT_STYLES ? (item.accent as AccentKey) : "neon"];

  const onInstall = async () => {
    setInstalling(true);
    try {
      await install({ slug: item.slug });
      setJustInstalled(true);
      toast.success(`${item.title} added to your panel`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  };

  const onComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim().length < 2) return;
    setSending(true);
    try {
      await addComment({ itemId: item._id, body: draft });
      setDraft("");
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post that");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Catalog
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]"
        >
          <div>
            <SectionTag tone={accent.tag}>{item.category}</SectionTag>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">
              {item.title}
            </h1>
            <p className={cn("mt-2 text-base font-semibold", accent.text)}>
              {item.tagline}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-mist">
              <span className="flex items-center gap-1.5">
                <Star className="size-3.5 fill-current text-ember" />
                {item.rating > 0 ? item.rating.toFixed(1) : "New"}
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="size-3.5" />
                {item.installs.toLocaleString()} installs
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                {item.comments.length}
              </span>
              <span>by {item.authorName}</span>
            </div>

            <div className="rune-rule my-8" />

            <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
              {item.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded border border-edge bg-abyss/50 px-2 py-1 font-mono text-[11px] text-mist"
                >
                  <TagIcon className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Install rail */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className={cn("slab p-6", accent.glow)}>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-mist">
                Access
              </p>
              <p className="mt-2 font-display text-3xl font-bold">
                {item.priceLabel}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                One entry, installed on the panel you are signed into.
              </p>

              <Button
                className="mt-5 w-full"
                onClick={onInstall}
                disabled={installing || justInstalled}
              >
                {justInstalled ? (
                  <>
                    <Check className="size-4" />
                    Installed
                  </>
                ) : installing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Installing…
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Install
                  </>
                )}
              </Button>

              <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-neon" />
                  Runs on your own devices
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-neon" />
                  No account required to read
                </p>
                <p className="flex items-center gap-2">
                  <Check className="size-3.5 text-neon" />
                  Uninstall restores the previous state
                </p>
              </div>
            </div>
          </aside>
        </motion.div>

        {/* Comments */}
        <section className="mt-16">
          <h2 className="font-display text-xl font-bold">
            Discussion
            <span className="ml-2 text-sm font-normal text-mist">
              {item.comments.length}
            </span>
          </h2>

          <form onSubmit={onComment} className="slab mt-5 p-5">
            {isAuthenticated ? (
              <>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about this entry, or say how you are using it…"
                />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" disabled={sending || draft.trim().length < 2}>
                    {sending ? "Posting…" : "Post comment"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Sign in to join the discussion.
                </p>
                <Button variant="outline" asChild>
                  <Link to={`/auth?returnTo=/catalog/${item.slug}`}>Sign in</Link>
                </Button>
              </div>
            )}
          </form>

          {item.comments.length === 0 ? (
            <p className="mt-6 text-sm text-mist">
              No comments yet. Be the first to say something useful.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {item.comments.map((comment) => (
                <div key={comment._id} className="slab p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-neon/30 to-holo/30 text-[11px] font-bold">
                      {comment.authorName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold">
                      {comment.authorName}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-mist">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {(related ?? []).length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl font-bold">Related entries</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {(related ?? []).map((r, i) => (
                <CatalogCard key={r._id} item={r} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
