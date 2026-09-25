import { AdminHead } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { readAdminToken } from "@/lib/admin-token";
import { useMutation, useQuery } from "convex/react";
import { Mail, MailOpen, MessagesSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

/** Community posts, with the ability to remove anything out of place. */
export function AdminPosts() {
  const token = readAdminToken() ?? "";
  const posts = useQuery(api.admin.listAllPosts, { token });
  const remove = useMutation(api.admin.removePost);

  return (
    <div>
      <AdminHead
        eyebrow="Admin · Community"
        title="Community posts"
        description="Everything members have published. Remove anything that is spam, broken, or no longer accurate."
      />

      {(posts ?? []).length === 0 ? (
        <div className="slab p-10 text-center text-sm text-muted-foreground">
          Nothing published yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(posts ?? []).map((post) => (
            <article key={post._id} className="slab p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display font-bold">{post.title}</h3>
                  <p className="mt-0.5 text-[11px] text-mist">
                    {post.authorName} · {post.kind} ·{" "}
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-rose-300 hover:bg-rose-500/10"
                  onClick={async () => {
                    await remove({ token, id: post._id });
                    toast.success("Post removed");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {post.body}
              </p>
              {post.link && (
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-mono text-[11px] text-neon hover:text-ember"
                >
                  {post.link}
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Messages sent through the contact form. */
export function AdminInbox() {
  const token = readAdminToken() ?? "";
  const inquiries = useQuery(api.admin.listInquiries, { token });
  const setRead = useMutation(api.admin.setInquiryRead);

  return (
    <div>
      <AdminHead
        eyebrow="Admin · Inbox"
        title="Messages"
        description="Direct messages sent from the site. Mark them read as you work through them."
      />

      {(inquiries ?? []).length === 0 ? (
        <div className="slab p-10 text-center text-sm text-muted-foreground">
          <MessagesSquare className="mx-auto mb-3 size-6 text-mist" />
          No messages yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(inquiries ?? []).map((msg) => (
            <article
              key={msg._id}
              className={cn("slab p-5", !msg.read && "border-ember/40")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold">{msg.subject}</h3>
                    {!msg.read && (
                      <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] font-bold uppercase text-ember">
                        new
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-mist">
                    {msg.name} · {msg.email} ·{" "}
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRead({ token, id: msg._id, read: !msg.read })}
                >
                  {msg.read ? (
                    <>
                      <Mail className="size-3" />
                      Mark unread
                    </>
                  ) : (
                    <>
                      <MailOpen className="size-3" />
                      Mark read
                    </>
                  )}
                </Button>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {msg.message}
              </p>
              <a
                href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject}`)}`}
                className="mt-3 inline-block text-xs font-semibold text-neon transition-colors hover:text-ember"
              >
                Reply to {msg.email} →
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
