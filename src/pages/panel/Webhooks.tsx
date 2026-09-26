import { EmptyState } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePanelActions,
  useWebhookDeliveries,
  useWebhooks,
} from "@/hooks/use-panel";
import type { GenericId } from "convex/values";
import { WEBHOOK_EVENTS } from "@/convex/schema";
import { Boxes, Plus, Send, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Human labels for the event names the schema allows. */
const EVENT_LABELS: Record<string, string> = {
  "connection.update": "Connection lifecycle",
  "messages.upsert": "Inbound messages",
  "message.receipt.update": "Delivery receipts",
  "creds.update": "Credential rotation",
};

export default function Webhooks() {
  const hooks = useWebhooks();
  const deliveries = useWebhookDeliveries(10);
  const { createWebhook, toggleWebhook, deleteWebhook, testWebhook } =
    usePanelActions();
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>(["messages.upsert"]);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState<string | undefined>();

  /**
   * Fire one event at one endpoint.
   *
   * The delivery runs server-side and is recorded either way, so this button
   * answers "is my receiver wired up?" with a status code instead of a guess.
   */
  const runTest = async (webhookId: GenericId<"webhooks">) => {
    setTesting(webhookId);
    try {
      const result = await testWebhook({ webhookId });
      if (result.ok) {
        toast.success(`Delivered — ${result.status} in ${result.durationMs}ms`);
      } else {
        toast.error(
          `Endpoint refused it — ${
            result.status === 0 ? result.detail : `HTTP ${result.status}`
          }`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setTesting(undefined);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await createWebhook({ url: url.trim(), events: selected });
      setUrl("");
      setSelected(["messages.upsert"]);
      toast.success("Endpoint registered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add endpoint");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow="Integrations"
        title="Webhooks"
        description="Push raw Baileys events to your own services. Every connection, message and receipt the agent reports is POSTed to the endpoints you pick here, and every attempt is logged."
      />

      <form onSubmit={submit} className="slab mb-6 p-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
          Register an endpoint
        </h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hook-url">Endpoint URL</Label>
            <div className="relative">
              <Webhook className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" />
              <Input
                id="hook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/whatsapp/events"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((ev) => {
                const on = selected.includes(ev);
                return (
                  <button
                    key={ev}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(ev)
                          ? prev.filter((x) => x !== ev)
                          : [...prev, ev],
                      )
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-xs transition-all",
                      on
                        ? "border-neon/50 bg-neon/10 text-foreground"
                        : "border-edge text-muted-foreground hover:border-edge-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3.5 shrink-0 rounded-[4px] border transition-colors",
                        on
                          ? "border-neon bg-neon shadow-[0_0_8px_oklch(0.8_0.16_200/70%)]"
                          : "border-edge-strong",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {EVENT_LABELS[ev] ?? ev}
                      </span>
                      <span className="block font-mono text-[10px] text-mist">
                        {ev}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={pending || !url.trim()}>
            <Plus className="size-4" />
            {pending ? "Registering…" : "Add endpoint"}
          </Button>
        </div>
      </form>

      {(hooks ?? []).length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No endpoints yet"
          description="Register a URL above and the panel will forward the Baileys events you select to it."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(hooks ?? []).map((hook) => (
            <div key={hook._id} className="slab flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-mono text-xs">
                  {hook.url}
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    hook.enabled
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-edge text-mist",
                  )}
                >
                  {hook.enabled ? "live" : "paused"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {hook.events.map((ev) => (
                  <span
                    key={ev}
                    className="rounded border border-edge bg-abyss/60 px-2 py-0.5 font-mono text-[10px] text-mist"
                  >
                    {ev}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-mist">
                <span>{hook.deliveries} delivered</span>
                <span className={hook.failures > 0 ? "text-rose-300" : undefined}>
                  {hook.failures} failed
                </span>
                <span>
                  {hook.lastStatus ? `last HTTP ${hook.lastStatus}` : "never called"}
                </span>
              </div>

              <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testing === hook._id}
                  onClick={() => runTest(hook._id)}
                >
                  <Send className="size-3" />
                  {testing === hook._id ? "Sending…" : "Send test"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleWebhook({ webhookId: hook._id })}
                >
                  {hook.enabled ? "Pause" : "Resume"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-rose-300 hover:bg-rose-500/10"
                  onClick={() => {
                    void deleteWebhook({ webhookId: hook._id });
                    toast.success("Endpoint removed");
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(deliveries ?? []).length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
            Recent deliveries
          </h3>
          <div className="well divide-y divide-white/5">
            {(deliveries ?? []).map((row) => (
              <div
                key={row._id}
                className="flex items-center gap-3 px-4 py-2.5 font-mono text-[11px]"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                    row.ok
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-rose-400/40 bg-rose-400/10 text-rose-300",
                  )}
                >
                  {row.statusCode ? row.statusCode : "fail"}
                </span>
                <span className="shrink-0 text-neon">{row.event}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {row.url}
                </span>
                <span className="shrink-0 text-mist">{row.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
