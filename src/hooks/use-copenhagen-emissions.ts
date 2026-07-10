import { useEffect, useState } from "react";
import type { CopenhagenEmissionsSnapshot } from "@/types/copenhagen-emissions";
import { loadCopenhagenEmissionsSnapshot } from "@/services/copenhagenEmissionsSnapshots";

export function useCopenhagenEmissions() {
  const [snapshot, setSnapshot] = useState<CopenhagenEmissionsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadCopenhagenEmissionsSnapshot().then((data) => {
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
