import { useEffect, useState } from "react";
import type { CopenhagenNearEncountersSnapshot } from "@/types/copenhagen-encounters";
import { loadCopenhagenNearEncountersSnapshot } from "@/services/copenhagenEncounterSnapshots";

export function useCopenhagenNearEncounters() {
  const [snapshot, setSnapshot] = useState<CopenhagenNearEncountersSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadCopenhagenNearEncountersSnapshot().then((data) => {
      if (!cancelled) {
        setSnapshot(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { snapshot, loading };
}
