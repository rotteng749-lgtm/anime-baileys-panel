import { api } from "@/convex/_generated/api";
import type { SessionId } from "@/hooks/use-panel";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";

/**
 * Drive an install.
 *
 * The install queue runs in steps, the way an install does on a real node: the
 * runtime resolves, the script runs, dependencies land. `useInstallProgress`
 * polls one until the queue reports it is done.
 */
type InstallArgs = {
  sessionId: SessionId;
  eggSlug: string;
  variables?: string[];
};

/** The branded Convex id type for an install. */
type InstallId = GenericId<"sessionInstalls">;

export type { InstallArgs, InstallId };

export function useInstallFlow() {
  const [installId, setInstallId] = useState<InstallId | undefined>();
  const [variables, setVariables] = useState<Record<string, string>>({});
  const installEgg = useMutation(api.eggs.installEgg);
  const advance = useMutation(api.eggs.advanceInstall);

  const install = useCallback(
    async (args: InstallArgs) => {
      const id = await installEgg(args);
      setInstallId(id);
      return id;
    },
    [installEgg],
  );

  const setVariable = useCallback((key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    install,
    installing: false,
    installId,
    variables,
    setVariable,
    advance,
  };
}

/** Poll a specific install until it finishes. */
export function useInstallProgress(installId: InstallId | undefined) {
  const advance = useMutation(api.eggs.advanceInstall);
  const install = useQuery(
    api.eggs.getInstall,
    installId ? { installId } : "skip",
  );

  const running =
    install?.status === "queued" || install?.status === "installing";

  useEffect(() => {
    if (!installId || !running) return;
    const timer = setInterval(() => void advance({ installId }), 1_200);
    return () => clearInterval(timer);
  }, [installId, running, advance]);

  return install;
}
