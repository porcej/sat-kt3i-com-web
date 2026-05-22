import type { CatalogRecord, SatelliteGroup, TleCachePayload } from "@sat/shared";

const base = (): string => {
  const b = import.meta.env.VITE_API_BASE;
  if (b === undefined || b === "") return "";
  return b.replace(/\/$/, "");
};

/** Shown when Pages serves index.html for /api/* (missing Worker route or VITE_API_BASE). */
export const API_HTML_ROUTING_HINT =
  "API returned HTML instead of JSON. Set VITE_API_BASE to your sat-api Worker URL in Cloudflare Pages build variables (e.g. https://sat-api.<account>.workers.dev), or route /api/* on your zone to the Worker before the SPA.";

async function readJson<T>(r: Response, label: string): Promise<T> {
  const ct = r.headers.get("content-type") ?? "";
  const text = await r.text();
  const trimmed = text.trimStart();

  if (!r.ok) {
    if (trimmed.startsWith("<")) {
      throw new Error(`${label} ${r.status}: ${API_HTML_ROUTING_HINT}`);
    }
    throw new Error(`${label} ${r.status}: ${text.slice(0, 240)}`);
  }

  if (
    trimmed.startsWith("<") ||
    (!ct.includes("json") && trimmed.length > 0 && trimmed[0] !== "{" && trimmed[0] !== "[")
  ) {
    throw new Error(API_HTML_ROUTING_HINT);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}: invalid JSON (${text.slice(0, 120)}…)`);
  }
}

export async function fetchGroups(): Promise<{ groups: SatelliteGroup[] }> {
  const r = await fetch(`${base()}/api/groups`);
  return readJson(r, "groups");
}

export async function fetchTle(groupId: string): Promise<TleCachePayload> {
  const r = await fetch(
    `${base()}/api/tle?group=${encodeURIComponent(groupId)}`
  );
  return readJson(r, "tle");
}

export async function fetchElements(
  satelliteId: number,
  groupId?: string
): Promise<{ satelliteId: number; source: string; record: CatalogRecord | null }> {
  const q = new URLSearchParams({ satelliteId: String(satelliteId) });
  if (groupId) q.set("group", groupId);
  const r = await fetch(`${base()}/api/elements?${q}`);
  return readJson(r, "elements");
}
