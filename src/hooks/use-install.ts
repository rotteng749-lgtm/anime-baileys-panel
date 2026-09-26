import { api } from "@/convex/_generated/api";
import type { SessionId } from "@/hooks/use-panel";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";

/**
 * Egg installs.
 *
 * Installing is a request for work, not a progress bar: the panel lays the
 * egg's files down, queues an `install` command for the node's agent, and the
 * transcript fills up with lines the install script actually printed. With no
 * agent attached the install stays queued, which is the honest answer.
 */
type InstallArgs = {
  sessionId: SessionId;
  eggSlug: string;
  variables?: string[];
  skipScripts?: boolean;
};

/** The branded Convex id type for an install. */
type InstallId = GenericId<"sessionInstalls">;

export type { InstallArgs, InstallId };

export function useInstallFlow() {
  const [installId, setInstallId] = useState<InstallId | undefined>();
  const [variables, setVariables] = useState<Record<string, string>>({});
  const installEgg = useMutation(api.eggs.installEgg);

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
  };
}

/** Watch an install. The agent writes the transcript as it runs. */
export function useInstallProgress(installId: InstallId | undefined) {
  return useQuery(
    api.eggs.getInstall,
    installId ? { installId } : "skip",
  );
}
