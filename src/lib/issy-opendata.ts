/** Issy explore v2.1 API: -1 <= limit <= 100 per request */
export const ISSY_OPENDATA_MAX_LIMIT = 100;

export function clampOpendataLimit(limit: number): number {
  return Math.min(Math.max(1, Math.floor(limit)), ISSY_OPENDATA_MAX_LIMIT);
}

export interface OpendataPage<T> {
  total_count: number;
  results: T[];
}

/**
 * Fetches multiple pages when callers request more than ISSY_OPENDATA_MAX_LIMIT rows.
 */
export async function fetchOpendataPaginated<T>(
  fetchPage: (limit: number, offset: number) => Promise<OpendataPage<T>>,
  desiredLimit: number
): Promise<OpendataPage<T>> {
  const target = Math.max(1, Math.floor(desiredLimit));
  const pageSize = ISSY_OPENDATA_MAX_LIMIT;
  let offset = 0;
  const results: T[] = [];
  let total_count = 0;

  while (results.length < target) {
    const chunk = Math.min(pageSize, target - results.length);
    const page = await fetchPage(chunk, offset);
    total_count = page.total_count;
    const batch = page.results ?? [];
    if (batch.length === 0) break;
    results.push(...batch);
    offset += batch.length;
    if (offset >= total_count) break;
  }

  return { total_count, results };
}
