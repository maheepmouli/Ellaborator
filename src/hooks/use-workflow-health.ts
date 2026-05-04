import { useQuery } from "@tanstack/react-query";
import { SHAREPOINT_CITY_DATASETS } from "@/data/sharepointDatasets";
import {
  getTrafficApiUrl,
  getBicycleCountingApiUrl,
  getCyclingInfrastructureApiUrl,
} from "@/lib/api-config";

export type WorkflowStatus = "working" | "not-working";

export interface WorkflowCheck {
  name: string;
  status: WorkflowStatus;
  detail: string;
}

async function checkUrl(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status} ${response.statusText}` };
    }
    return { ok: true, detail: "Endpoint reachable" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, detail: message };
  }
}

async function checkDatasetFile(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(encodeURI(path), { method: "HEAD" });
    if (!response.ok) {
      return { ok: false, detail: `Missing or unreadable file (${response.status})` };
    }
    return { ok: true, detail: "File available from public assets" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return { ok: false, detail: message };
  }
}

export function useWorkflowHealth() {
  return useQuery({
    queryKey: ["workflow-health"],
    queryFn: async () => {
      const checks: WorkflowCheck[] = [];

      const apiChecks = [
        { name: "Issy Traffic API", url: `${getTrafficApiUrl()}?limit=1&timezone=Europe%2FBerlin` },
        {
          name: "Issy Bicycle Counting API",
          url: `${getBicycleCountingApiUrl()}?limit=1&timezone=Europe%2FBerlin`,
        },
        {
          name: "Issy Cycling Infrastructure API",
          url: `${getCyclingInfrastructureApiUrl()}?limit=1&timezone=Europe%2FBerlin`,
        },
      ];

      for (const api of apiChecks) {
        const result = await checkUrl(api.url);
        checks.push({
          name: api.name,
          status: result.ok ? "working" : "not-working",
          detail: result.detail,
        });
      }

      for (const dataset of SHAREPOINT_CITY_DATASETS) {
        const result = await checkDatasetFile(dataset.sampleFile);
        checks.push({
          name: `${dataset.city} dataset files`,
          status: result.ok ? "working" : "not-working",
          detail: result.ok
            ? `${dataset.fileCount} files staged in ${dataset.sourceFolder}`
            : result.detail,
        });
      }

      checks.push({
        name: "Real-data map rendering for non-Issy cities",
        status: "working",
        detail: "Point-based KPIs now render from local SharePoint datasets; segment/area KPIs still rely on current modelling layers.",
      });
      checks.push({
        name: "Real-data rendering for segment/area KPIs outside Issy",
        status: "not-working",
        detail: "Only point-based non-Issy views currently use local SharePoint files; segment/area layers still use generated geometry.",
      });

      return {
        checks,
        totals: {
          working: checks.filter((c) => c.status === "working").length,
          notWorking: checks.filter((c) => c.status === "not-working").length,
        },
      };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
