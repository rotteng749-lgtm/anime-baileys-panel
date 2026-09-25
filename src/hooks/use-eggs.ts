import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

/**
 * Fill in the runtimes and starter eggs on first view.
 *
 * Both seeds are idempotent — they only add what is missing — so calling this
 * from any public page is safe.
 */
export function useEggsReady(eggCount: number | undefined, runtimeCount: number | undefined) {
  const seed = useMutation(api.seed.seedAll);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    if (eggCount === undefined || runtimeCount === undefined) return;
    if (eggCount > 0 && runtimeCount > 0) return;
    done.current = true;
    void seed({});
  }, [eggCount, runtimeCount, seed]);
}
