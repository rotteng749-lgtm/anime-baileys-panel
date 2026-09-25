import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePanelActions } from "@/hooks/use-panel";
import { useNavigate } from "react-router";
import { Plus, QrCode, Smartphone, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Provision a new Baileys device. The pairing method is chosen up front
 * because it changes the handshake: a QR ref is scanned from the phone,
 * a pairing code is typed into it.
 */
export function NewSessionForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pairMethod, setPairMethod] = useState<"qr" | "code">("qr");
  const [pending, setPending] = useState(false);
  const { createSession } = usePanelActions();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the session a name");
      return;
    }
    setPending(true);
    try {
      const id = await createSession({
        name: name.trim(),
        phone: phone.trim() || undefined,
        pairMethod,
      });
      setOpen(false);
      setName("");
      setPhone("");
      toast.success("Session provisioned");
      navigate(`/panel/console?session=${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create session");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New session
        </Button>
      </DialogTrigger>
      <DialogContent className="border-edge bg-surface sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Provision a device</DialogTitle>
          <DialogDescription>
            Each session is one WhatsApp number linked over its own Baileys
            socket, with its own creds and console.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Session name</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" />
              <Input
                id="session-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="support-desk"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-phone">Number (optional)</Label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" />
              <Input
                id="session-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 812 3456 7890"
                className="pl-9"
              />
            </div>
            <p className="text-[11px] text-mist">
              Used to derive the JID. You can link a number later.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Pairing method</Label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: "qr", label: "QR ref", icon: QrCode, hint: "Scan in app" },
                  { id: "code", label: "Pairing code", icon: Smartphone, hint: "Type 8 digits" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPairMethod(opt.id)}
                  className={cn(
                    "btn-3d flex flex-col items-start gap-1 p-3 text-left",
                    pairMethod === opt.id &&
                      "border-neon/60 glow-neon text-foreground",
                  )}
                >
                  <opt.icon className="size-4 text-neon" />
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] text-mist">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Provisioning…" : "Create & open console"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
