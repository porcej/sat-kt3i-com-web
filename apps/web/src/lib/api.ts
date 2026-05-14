import type { CatalogRecord, SatelliteGroup, TleCachePayload } from "@sat/shared";

const base = (): string => {
  const b = import.meta.env.VITE_API_BASE;
  if (b === undefined || b === "") return "";
  return b.replace(/\/$/, "");
};

export async function fetchGroups(): Promise<{ groups: SatelliteGroup[] }> {
  const r = await fetch(`${base()}/api/groups`);
  if (!r.ok) throw new Error(`groups ${r.status}`);
  return r.json() as Promise<{ groups: SatelliteGroup[] }>;
}

export async function fetchTle(groupId: string): Promise<TleCachePayload> {
  const r = await fetch(
    `${base()}/api/tle?group=${encodeURIComponent(groupId)}`
  );
  if (!r.ok) throw new Error(`tle ${r.status}`);
  return r.json() as Promise<TleCachePayload>;
}

export async function fetchElements(
  satelliteId: number,
  groupId?: string
): Promise<{ satelliteId: number; source: string; record: CatalogRecord | null }> {
  const q = new URLSearchParams({ satelliteId: String(satelliteId) });
  if (groupId) q.set("group", groupId);
  const r = await fetch(`${base()}/api/elements?${q}`);
  if (!r.ok) throw new Error(`elements ${r.status}`);
  return r.json() as Promise<{
    satelliteId: number;
    source: string;
    record: CatalogRecord | null;
  }>;
}
