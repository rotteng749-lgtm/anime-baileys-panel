import { PanelShell } from "@/components/panel/Shell";
import { Outlet } from "react-router";

/** Authenticated panel layout — the shell wraps every nested route. */
export default function PanelLayout() {
  return (
    <PanelShell>
      <Outlet />
    </PanelShell>
  );
}
