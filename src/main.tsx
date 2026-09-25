import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const CatalogItem = lazy(() => import("./pages/CatalogItem.tsx"));
const Eggs = lazy(() => import("./pages/Eggs.tsx"));
const EggDetail = lazy(() => import("./pages/EggDetail.tsx"));
const EggPublish = lazy(() => import("./pages/EggPublish.tsx"));
const Wings = lazy(() => import("./pages/Wings.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const Book = lazy(() => import("./pages/Book.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const PanelLayout = lazy(() => import("./components/panel/PanelLayout.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Sessions = lazy(() => import("./pages/panel/Sessions.tsx"));
const Files = lazy(() => import("./pages/panel/Files.tsx"));
const WingsPanel = lazy(() => import("./pages/panel/Wings.tsx"));
const Console = lazy(() => import("./pages/panel/Console.tsx"));
const Messages = lazy(() => import("./pages/panel/Messages.tsx"));
const Webhooks = lazy(() => import("./pages/panel/Webhooks.tsx"));
const Keys = lazy(() => import("./pages/panel/Keys.tsx"));
const Posts = lazy(() => import("./pages/panel/Posts.tsx"));
const MyBookings = lazy(() => import("./pages/panel/MyBookings.tsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));
const AdminShell = lazy(() => import("./components/admin/AdminShell.tsx").then((m) => ({ default: m.AdminShell })));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview.tsx"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog.tsx"));
const AdminEggs = lazy(() => import("./pages/admin/AdminEggs.tsx"));
const AdminInfrastructure = lazy(
  () => import("./pages/admin/AdminInfrastructure.tsx"),
);
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings.tsx"));
const AdminCommunity = lazy(() =>
  import("./pages/admin/AdminCommunity.tsx").then((m) => ({
    default: m.AdminPosts,
  })),
);
const AdminInbox = lazy(() =>
  import("./pages/admin/AdminCommunity.tsx").then((m) => ({
    default: m.AdminInbox,
  })),
);
const AdminMembers = lazy(() => import("./pages/admin/AdminMembers.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-2xl border-2 border-neon/25 border-t-neon shadow-[0_0_20px_-4px_oklch(0.8_0.16_200/60%)]" />
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-mist">
          Loading
        </p>
      </div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/catalog/:slug" element={<CatalogItem />} />
              <Route path="/eggs" element={<Eggs />} />
              <Route path="/eggs/publish" element={<EggPublish />} />
              <Route path="/eggs/:slug" element={<EggDetail />} />
              <Route path="/wings" element={<Wings />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/book" element={<Book />} />
              <Route path="/contact" element={<Contact />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />

              {/* Member area */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth
                    title="Sign in to reach your panel"
                    description="Your devices, posts and bookings live behind a sign-in. It takes one email code."
                  >
                    <PanelLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="sessions" element={<Sessions />} />
                <Route path="files" element={<Files />} />
                <Route path="wings" element={<WingsPanel />} />
                <Route path="console" element={<Console />} />
                <Route path="messages" element={<Messages />} />
                <Route path="webhooks" element={<Webhooks />} />
                <Route path="keys" element={<Keys />} />
                <Route path="posts" element={<Posts />} />
                <Route path="bookings" element={<MyBookings />} />
              </Route>

              {/* Admin area — its own door, its own credentials */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route path="overview" element={<AdminOverview />} />
                <Route path="catalog" element={<AdminCatalog />} />
                <Route path="eggs" element={<AdminEggs />} />
                <Route
                  path="infrastructure"
                  element={<AdminInfrastructure />}
                />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="posts" element={<AdminCommunity />} />
                <Route path="inbox" element={<AdminInbox />} />
                <Route path="members" element={<AdminMembers />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
