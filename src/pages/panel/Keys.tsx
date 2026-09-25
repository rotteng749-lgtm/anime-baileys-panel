import { EmptyState } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePanelActions, usePanelKeys } from "@/hooks/use-panel";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Keys() {
  const keys = usePanelKeys();
  const { createKey, deleteKey } = usePanelActions();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const result = await createKey({ name: name.trim() || "Runtime key" });
      setRevealed(result.secret);
      setName("");
      toast.success("Key created — copy it now, it is not shown again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <PageHead
        eyebrow="Integrations"
        title="API Keys"
        description="Authenticate your own runtime against the panel. Keys are shown once at creation — only a hash is stored."
      />

      <form onSubmit={submit} className="slab mb-6 p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
          Issue a key
        </h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="key-name">Label</Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production-bot"
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus className="size-4" />
            {pending ? "Creating…" : "Create key"}
          </Button>
        </div>

        {revealed && (
          <div className="mt-4 rounded-lg border border-neon/40 bg-neon/8 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
              Copy this now
            </p>
            <div className="flex items-center gap-2">
              <code className="well flex-1 truncate px-3 py-2 font-mono text-xs">
                {revealed}
              </code>
              <Button size="icon" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="size-4 text-emerald-300" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </form>

      {(keys ?? []).length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No keys issued"
          description="Create a key above to call the panel from your own Baileys runtime."
        />
      ) : (
        <div className="well divide-y divide-white/5">
          {(keys ?? []).map((key) => (
            <div
              key={key._id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-holo/30 bg-holo/10 text-holo">
                <KeyRound className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{key.name}</p>
                <p className="truncate font-mono text-[10px] text-mist">
                  {key.prefix}••••••••••••
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-mist">
                {new Date(key.createdAt).toLocaleDateString()}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  void deleteKey({ keyId: key._id });
                  toast.success("Key revoked");
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="slab mt-6 p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
          Using a key
        </h3>
        <pre className="well mt-3 overflow-x-auto p-4 text-[11px] leading-relaxed">
          <code>{`const res = await fetch("${"${PANEL_URL}"}/api/sessions", {
  headers: { Authorization: \`Bearer \${key}\` },
});
const { sessions } = await res.json();`}</code>
        </pre>
      </div>
    </div>
  );
}
