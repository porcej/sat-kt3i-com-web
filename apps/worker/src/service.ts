import type { CatalogRecord, TleCachePayload } from "@sat/shared";
import { getGroupById } from "./groups.js";
import { kvKeyForGroup, parseCache, serializeCache } from "./kv.js";
import {
  fetchAmsatTle,
  fetchCelestrakGpJson,
  fetchCelestrakTleText,
  fetchSpaceTrackGp,
  mergeTleFromBulletinText,
  spaceTrackLogin,
} from "./upstream.js";

export interface WorkerEnv {
  TLE_KV: KVNamespace;
  SOFT_TTL_MINUTES?: string;
  HARD_TTL_MINUTES?: string;
  SPACE_TRACK_USER?: string;
  SPACE_TRACK_PASSWORD?: string;
}

function softTtlMs(env: WorkerEnv): number {
  const m = Number.parseInt(env.SOFT_TTL_MINUTES ?? "120", 10);
  return (Number.isFinite(m) ? m : 120) * 60_000;
}

function hardTtlMs(env: WorkerEnv): number {
  const m = Number.parseInt(env.HARD_TTL_MINUTES ?? "720", 10);
  return (Number.isFinite(m) ? m : 720) * 60_000;
}

async function fetchUpstreamForGroup(
  env: WorkerEnv,
  groupId: string
): Promise<{ satellites: CatalogRecord[]; source: string }> {
  const meta = getGroupById(groupId);
  if (!meta) throw new Error(`Unknown group: ${groupId}`);

  if (meta.source === "celestrak") {
    const g = meta.celestrakGroup ?? meta.id;
    const satellites = await fetchCelestrakGpJson(g);
    return { satellites, source: "celestrak" };
  }

  if (meta.source === "amsat") {
    const url = meta.tleUrl;
    if (!url) throw new Error("AMSAT group missing tleUrl");
    const satellites = await fetchAmsatTle(url);
    return { satellites, source: "amsat" };
  }

  if (meta.source === "space-track") {
    const user = env.SPACE_TRACK_USER;
    const pass = env.SPACE_TRACK_PASSWORD;
    if (!user || !pass) {
      throw new Error("Space-Track credentials not configured");
    }
    const q = meta.spaceTrackQuery;
    if (!q) throw new Error("Space-Track group missing spaceTrackQuery");
    const cookie = await spaceTrackLogin(user, pass);
    if (!cookie) throw new Error("Space-Track login failed");
    let satellites = await fetchSpaceTrackGp(cookie, q);
    try {
      const bulletin = await fetchCelestrakTleText("stations");
      satellites = mergeTleFromBulletinText(satellites, bulletin);
    } catch {
      /* best-effort TLE merge for propagation */
    }
    return { satellites, source: "space-track" };
  }

  throw new Error(`Unsupported source for group ${groupId}`);
}

export async function writeGroupCache(
  env: WorkerEnv,
  groupId: string,
  satellites: CatalogRecord[],
  source: string,
  lastError?: string
): Promise<TleCachePayload> {
  const payload: TleCachePayload = {
    fetchedAt: new Date().toISOString(),
    source,
    groupId,
    satellites,
    lastError,
  };
  await env.TLE_KV.put(kvKeyForGroup(groupId), serializeCache(payload), {
    expirationTtl: 60 * 60 * 24 * 7,
  });
  return payload;
}

export async function refreshGroupCache(
  env: WorkerEnv,
  groupId: string
): Promise<TleCachePayload> {
  try {
    const { satellites, source } = await fetchUpstreamForGroup(env, groupId);
    return await writeGroupCache(env, groupId, satellites, source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const prev = parseCache(await env.TLE_KV.get(kvKeyForGroup(groupId)));
    const payload: TleCachePayload = {
      fetchedAt: prev?.fetchedAt ?? new Date().toISOString(),
      source: prev?.source ?? "error",
      groupId,
      satellites: prev?.satellites ?? [],
      lastError: msg,
    };
    await env.TLE_KV.put(kvKeyForGroup(groupId), serializeCache(payload), {
      expirationTtl: 60 * 60 * 24,
    });
    return payload;
  }
}

export async function getGroupPayloadWithSwr(
  env: WorkerEnv,
  groupId: string,
  ctx?: ExecutionContext
): Promise<TleCachePayload> {
  const key = kvKeyForGroup(groupId);
  const raw = await env.TLE_KV.get(key);
  const cached = parseCache(raw);
  const now = Date.now();

  if (!cached) {
    return refreshGroupCache(env, groupId);
  }

  const fetched = new Date(cached.fetchedAt).getTime();
  const age = now - fetched;
  const hard = hardTtlMs(env);
  const soft = softTtlMs(env);

  if (age > hard) {
    return refreshGroupCache(env, groupId);
  }

  if (age > soft && ctx) {
    ctx.waitUntil(refreshGroupCache(env, groupId));
  }

  return cached;
}
