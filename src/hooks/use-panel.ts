import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

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

export function useRecentMessages(limit = 12) {
  return useQuery(api.sessions.recentMessages, { limit });
}

/** Console lines for one session, kept fresh by the tick loop. */
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
 * Drives the socket runtime.
 *
 * A linked device keeps its own heartbeat; the panel plays that role here by
 * advancing the handshake and sampling meters on a short interval, exactly
 * like watching a live process in a server console.
 *
 * The session list is read through a ref so the intervals are created once.
 * If they restarted on every query update, a live socket — whose meters change
 * on each sample — would keep resetting its own timer and never report.
 */
export function useRuntimeLoop(
  sessions: Array<{ _id: SessionId; status: string }> | undefined,
) {
  const tick = useMutation(api.waRuntime.tick);
  const sample = useMutation(api.waRuntime.sampleMeters);
  const inbound = useMutation(api.waRuntime.receiveMessage);
  const latest = useRef(sessions);
  useEffect(() => {
    latest.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const handshake = setInterval(() => {
      for (const s of latest.current ?? []) {
        if (s.status !== "connected") void tick({ sessionId: s._id });
      }
    }, 1_500);

    const meters = setInterval(() => {
      for (const s of latest.current ?? []) {
        if (s.status === "connected") void sample({ sessionId: s._id });
      }
    }, 4_000);

    // A live socket keeps receiving; pick one at random so the stream looks
    // like several conversations rather than one metronome.
    const traffic = setInterval(() => {
      const live = (latest.current ?? []).filter(
        (s) => s.status === "connected",
      );
      if (live.length === 0) return;
      const pick = live[Math.floor(Math.random() * live.length)];
      void inbound({ sessionId: pick._id });
    }, 11_000);

    return () => {
      clearInterval(handshake);
      clearInterval(meters);
      clearInterval(traffic);
    };
  }, [tick, sample, inbound]);
}

/** Every mutation the panel needs, in one place. */
export function usePanelActions() {
  return {
    createSession: useMutation(api.sessions.createSession),
    deleteSession: useMutation(api.sessions.deleteSession),
    renameSession: useMutation(api.sessions.renameSession),
    updateConfig: useMutation(api.sessions.updateConfig),
    disconnect: useMutation(api.sessions.disconnectSession),

    startPairing: useMutation(api.waRuntime.startPairing),
    regenerate: useMutation(api.waRuntime.regeneratePairing),
    completePairing: useMutation(api.waRuntime.completePairing),
    sendMessage: useMutation(api.waRuntime.sendMessage),
    receiveMessage: useMutation(api.waRuntime.receiveMessage),
    setAutoReply: useMutation(api.waRuntime.setAutoReply),

    createWebhook: useMutation(api.keys.createWebhook),
    toggleWebhook: useMutation(api.keys.toggleWebhook),
    deleteWebhook: useMutation(api.keys.deleteWebhook),

    createKey: useMutation(api.keys.createKey),
    deleteKey: useMutation(api.keys.deleteKey),
  };
}
