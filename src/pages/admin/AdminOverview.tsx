import { AdminHead } from "@/components/admin/AdminShell";
import { StatTile } from "@/components/panel/Parts";
import { readAdminToken } from "@/lib/admin-token";
import { useQuery } from "convex/react";
import {
  Boxes,
  CalendarClock,
  FileStack,
  Inbox,
  KeyRound,
  Radio,
  Smartphone,
  Users,
  Webhook,
} from "lucide-react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";

export default function AdminOverview() {
  const token = readAdminToken() ?? "";
  const stats = useQuery(api.admin.overview, { token });

  if (stats === undefined) {
    return <p className="font-mono text-xs text-mist">Loading…</p>;
  }

  return (
    <div>
      <AdminHead
        eyebrow="Admin"
        title="Everything at a glance"
        description="The catalog people install from, the bookings they make, what they post, and the devices running underneath."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Catalog entries"
          value={stats.catalog}
          hint={`${stats.published} published`}
          icon={Boxes}
          tone="neon"
        />
        <StatTile
          label="Bookings"
          value={stats.bookings}
          hint={`${stats.pending} awaiting confirmation`}
          icon={CalendarClock}
          tone="ember"
        />
        <StatTile
          label="Community posts"
          value={stats.posts}
          hint="across all members"
          icon={FileStack}
          tone="holo"
        />
        <StatTile
          label="Unread messages"
          value={stats.unread}
          hint="from the contact form"
          icon={Inbox}
          tone="sakura"
        />
        <StatTile
          label="Members"
          value={stats.members}
          hint="signed-up accounts"
          icon={Users}
          tone="holo"
        />
        <StatTile
          label="Linked devices"
          value={stats.devices}
          hint={`${stats.online} online`}
          icon={Smartphone}
          tone="mint"
        />
        <StatTile
          label="API keys"
          value={stats.keys}
          hint="issued to members"
          icon={KeyRound}
          tone="neon"
        />
        <StatTile
          label="Webhooks"
          value={stats.webhooks}
          hint="registered endpoints"
          icon={Webhook}
          tone="sakura"
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            to: "/admin/catalog",
            title: "Manage the catalog",
            body: "Add entries, edit copy, publish or hide them, and remove anything that has gone stale.",
            icon: Boxes,
          },
          {
            to: "/admin/bookings",
            title: "Confirm bookings",
            body: "Requests land here with a date and a topic. Confirm, or cancel and free the slot.",
            icon: CalendarClock,
          },
          {
            to: "/admin/inbox",
            title: "Read messages",
            body: "Anything sent through the contact form on the site lands in the inbox.",
            icon: Inbox,
          },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="slab group p-6 transition-transform duration-200 hover:-translate-y-1"
          >
            <card.icon className="size-5 text-ember" />
            <h2 className="mt-4 font-display text-lg font-bold">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {card.body}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neon transition-colors group-hover:text-ember">
              Open <Radio className="size-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
