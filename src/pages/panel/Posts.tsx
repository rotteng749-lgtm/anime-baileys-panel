import { EmptyState } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { FileText, Loader2, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const KINDS = [
  { id: "template", label: "Template", hint: "A canned reply set" },
  { id: "snippet", label: "Snippet", hint: "A reusable code block" },
  { id: "bot", label: "Bot", hint: "A whole conversation flow" },
  { id: "guide", label: "Guide", hint: "How you set something up" },
] as const;

export default function Posts() {
  const posts = useQuery(api.community.myPosts, {});
  const createPost = useMutation(api.community.createPost);
  const deletePost = useMutation(api.community.deletePost);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("template");
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await createPost({
        title,
        body,
        kind,
        link: link || undefined,
      });
      setTitle("");
      setBody("");
      setLink("");
      toast.success("Published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish that");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow="Yours"
        title="Your posts"
        description="Publish a template, a snippet, a bot or a guide. Anything you post shows on your dashboard and in the public feed."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form onSubmit={submit} className="slab h-fit space-y-4 p-6">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            Write something
          </h2>

          <div className="space-y-2">
            <Label htmlFor="post-kind">Kind</Label>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-all",
                    kind === k.id
                      ? "border-neon/50 bg-neon/10"
                      : "border-edge hover:border-edge-strong",
                  )}
                >
                  <span
                    className={cn(
                      "block text-xs font-bold",
                      kind === k.id ? "text-neon" : "text-foreground",
                    )}
                  >
                    {k.label}
                  </span>
                  <span className="block text-[10px] text-mist">{k.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekend promo auto-reply"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-body">Body</Label>
            <Textarea
              id="post-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What it does, how you use it, what to watch out for…"
              className="min-h-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-link">Link (optional)</Label>
            <Input
              id="post-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://github.com/…"
            />
          </div>

          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Send className="size-4" />
                Publish
              </>
            )}
          </Button>
        </form>

        <div>
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            Published
          </h2>
          {(posts ?? []).length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nothing published yet"
              description="Use the form to publish your first template, snippet or guide."
            />
          ) : (
            <div className="space-y-4">
              {(posts ?? []).map((post) => (
                <article key={post._id} className="slab p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display font-bold">
                        {post.title}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-mist">
                        {post.kind} · {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="shrink-0 text-rose-300 hover:bg-rose-500/10"
                      onClick={() => {
                        void deletePost({ postId: post._id });
                        toast.success("Post removed");
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                    {post.body}
                  </p>
                  {post.link && (
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block font-mono text-[11px] text-neon hover:text-ember"
                    >
                      {post.link}
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
