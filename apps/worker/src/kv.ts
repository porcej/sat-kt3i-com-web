import { TleCachePayloadSchema, type TleCachePayload } from "@sat/shared";

const KV_PREFIX = "celestrak:group:";

export function kvKeyForGroup(groupId: string): string {
  return `${KV_PREFIX}${groupId}`;
}

export function parseCache(raw: string | null): TleCachePayload | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    const r = TleCachePayloadSchema.safeParse(j);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function serializeCache(payload: TleCachePayload): string {
  return JSON.stringify(payload);
}
