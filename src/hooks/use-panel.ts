import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Panel data hooks.
 *
 * There is no runtime loop here any more. The panel does not advance a socket,
 * sample meters or invent inbound traffic: a real Baileys agent holds the
 * sockets, reports what they did, and everything below reads those reports.
 */

/** Live session list for the signed-in operator. */
export function useSessions() {
  return useQuery(api.sessions.listSessions, {});
}

/** The branded Convex id type for a session, taken from the query result. */
export type SessionRow = NonNullable<ReturnType<typeof useSessions>>[number];
export type SessionId = SessionRow["_id"];

export function useActivity() {
  return useQuery(api.sessions.activity, {});
}

/** The full server object for one session, joined to its node and allocation. */
export function useServerDetail(sessionId: SessionId | undefined) {
  return useQuery(
    api.sessions.serverDetail,
    sessionId ? { sessionId } : "skip",
  );
}

/** Nests, with how many eggs each one holds. */
export function useNests() {
  return useQuery(api.infrastructure.listNests, {});
}

/** Nodes, with their allocation and server counts. */
export function useNodes() {
  return useQuery(api.infrastructure.listNodes, {});
}

/** The four power verbs a hosting panel sends. */
export type PowerAction = "start" | "stop" | "restart" | "kill";

export function useRecentMessages(limit = 12) {
  return useQuery(api.sessions.recentMessages, { limit });
}

/** Console lines for one session, written by the agent's events. */
export function useSessionLogs(sessionId: SessionId | undefined) {
  return useQuery(
    api.sessions.sessionLogs,
    sessionId ? { sessionId } : "skip",
  );
}

export function useSessionMessages(sessionId: SessionId | undefined) {
  return useQuery(
    api.sessions.sessionMessages,
    sessionId ? { sessionId } : "skip",
  );
}

export function useWebhooks() {
  return useQuery(api.keys.listWebhooks, {});
}

export function usePanelKeys() {
  return useQuery(api.keys.listKeys, {});
}

/**
 * The agents this operator's servers are placed on.
 *
 * A worker row is a running wings agent: its heartbeat is the only thing that
 * makes a node `online`, so a crashed agent shows up here as an offline host
 * rather than a socket that looks alive.
 */
export function useWorkers() {
  return useQuery(api.runtimeDb.listWorkers, {});
}

/** The agent holding one node right now, if there is one. */
export function useAgent(nodeId: string | undefined) {
  const workers = useWorkers();
  if (!nodeId) return undefined;
  return (workers ?? []).find((w) => w.nodeId === nodeId && w.online);
}

/** The command queue for one server: what the panel asked for, and what came back. */
export function useSessionCommands(sessionId: SessionId | undefined, limit = 6) {
  return useQuery(
    api.runtimeDb.listCommands,
    sessionId ? { sessionId, limit } : "skip",
  );
}

/** What actually left the panel, endpoint by endpoint. */
export function useWebhookDeliveries(limit = 12) {
  return useQuery(api.keys.listDeliveries, { limit });
}

/**
 * Make sure the public catalog has its starter entries.
 *
 * On a fresh install the catalog is empty, which makes the browse page look
 * broken rather than new. Seeding is idempotent — it only adds slugs that are
 * missing — so this is safe to call on every public view.
 */
export function useStarterCatalog(count: number | undefined) {
  const seed = useMutation(api.catalog.seedCatalog);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    if (count === undefined || count > 0) return;
    seeded.current = true;
    void seed({});
  }, [count, seed]);
}

/** Every mutation the panel needs, in one place. */
export function usePanelActions() {
  return {
    createSession: useMutation(api.sessions.createSession),
    deleteSession: useMutation(api.sessions.deleteSession),
    renameSession: useMutation(api.sessions.renameSession),
    updateConfig: useMutation(api.sessions.updateConfig),
    disconnect: useMutation(api.sessions.disconnectSession),

    power: useMutation(api.sessions.powerAction),
    suspend: useMutation(api.sessions.suspendSession),

    /** Real socket control: queue it, and the agent does it. */
    requestPairing: useMutation(api.sessions.requestPairing),
    logout: useMutation(api.sessions.logoutSession),
    queueMessage: useMutation(api.sessions.queueMessage),
    setAutoReply: useMutation(api.sessions.setAutoReply),

    createWebhook: useMutation(api.keys.createWebhook),
    toggleWebhook: useMutation(api.keys.toggleWebhook),
    deleteWebhook: useMutation(api.keys.deleteWebhook),

    createKey: useMutation(api.keys.createKey),
    deleteKey: useMutation(api.keys.deleteKey),

    /** Sends one event at one endpoint, and records what came back. */
    testWebhook: useAction(api.runtime.webhookTest),
  };
}
