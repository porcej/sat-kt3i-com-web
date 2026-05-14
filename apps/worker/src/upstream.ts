import {
  OmmRecordSchema,
  type CatalogRecord,
  type TleOnlyRecord,
} from "@sat/shared";

const CELESTRAK_GP = "https://celestrak.org/NORAD/elements/gp.php";

/** Map NORAD id → TLE lines from a CelesTrak `FORMAT=tle` bulletin. */
export function tleLineMapFromBulletin(text: string): Map<number, { l1: string; l2: string }> {
  const m = new Map<number, { l1: string; l2: string }>();
  for (const row of parseTleBulletin(text)) {
    m.set(row.NORAD_CAT_ID, { l1: row.TLE_LINE1, l2: row.TLE_LINE2 });
  }
  return m;
}

export async function fetchCelestrakTleText(celestrakGroup: string): Promise<string> {
  const url = `${CELESTRAK_GP}?GROUP=${encodeURIComponent(
    celestrakGroup
  )}&FORMAT=tle`;
  const res = await fetch(url, {
    headers: { "User-Agent": "sat-kt3i-com-web/1.0 (worker)" },
  });
  if (!res.ok) throw new Error(`CelesTrak TLE HTTP ${res.status}`);
  return res.text();
}

/** GP JSON plus merged TLE lines for satellite.js `twoline2satrec`. */
export async function fetchCelestrakGpJson(
  celestrakGroup: string
): Promise<CatalogRecord[]> {
  const jsonUrl = `${CELESTRAK_GP}?GROUP=${encodeURIComponent(
    celestrakGroup
  )}&FORMAT=json`;
  const [jsonRes, tleText] = await Promise.all([
    fetch(jsonUrl, {
      headers: { "User-Agent": "sat-kt3i-com-web/1.0 (worker)" },
    }),
    fetchCelestrakTleText(celestrakGroup),
  ]);
  if (!jsonRes.ok) {
    throw new Error(`CelesTrak JSON HTTP ${jsonRes.status}`);
  }
  const data = (await jsonRes.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("CelesTrak: expected JSON array");
  }
  const tleMap = tleLineMapFromBulletin(tleText);
  const out: CatalogRecord[] = [];
  for (const row of data) {
    const p = OmmRecordSchema.safeParse(row);
    if (!p.success) continue;
    const lines = tleMap.get(p.data.NORAD_CAT_ID);
    out.push(
      lines
        ? { ...p.data, TLE_LINE1: lines.l1, TLE_LINE2: lines.l2 }
        : p.data
    );
  }
  return out;
}

/** Merge TLE lines from a bulletin into OMM records missing them (e.g. Space-Track GP JSON). */
export function mergeTleFromBulletinText(
  satellites: CatalogRecord[],
  tleBulletin: string
): CatalogRecord[] {
  const tleMap = tleLineMapFromBulletin(tleBulletin);
  return satellites.map((s) => {
    if ("EPOCH" in s && s.TLE_LINE1 && s.TLE_LINE2) return s;
    const lines = tleMap.get(s.NORAD_CAT_ID);
    if (lines && "EPOCH" in s) {
      return { ...s, TLE_LINE1: lines.l1, TLE_LINE2: lines.l2 };
    }
    return s;
  });
}

/** Parse standard 3-line (name + line1 + line2) TLE bulletins. */
export function parseTleBulletin(text: string): TleOnlyRecord[] {
  const raw = text.split(/\r?\n/);
  const lines = raw.map((l) => l.trimEnd()).filter((l) => l.length > 0);
  const out: TleOnlyRecord[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("1 ")) continue;
    const line1 = line;
    const line2 = lines[i + 1];
    if (!line2?.startsWith("2 ")) continue;
    const nameLine = i > 0 ? lines[i - 1]! : "UNKNOWN";
    const name =
      nameLine.startsWith("1 ") || nameLine.startsWith("2 ")
        ? "UNKNOWN"
        : nameLine.slice(0, 24).trim() || "UNKNOWN";
    const norad = Number.parseInt(line1.slice(2, 7).trim(), 10);
    if (!Number.isFinite(norad)) continue;
    out.push({
      OBJECT_NAME: name,
      NORAD_CAT_ID: norad,
      TLE_LINE1: line1,
      TLE_LINE2: line2,
    });
    i += 1;
  }
  return out;
}

export async function fetchAmsatTle(url: string): Promise<TleOnlyRecord[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "sat-kt3i-com-web/1.0 (worker)" },
  });
  if (!res.ok) throw new Error(`AMSAT TLE HTTP ${res.status}`);
  const text = await res.text();
  return parseTleBulletin(text);
}

const ST_LOGIN = "https://www.space-track.org/ajaxauth/login";

export async function spaceTrackLogin(
  identity: string,
  password: string
): Promise<string | null> {
  const body = new URLSearchParams({ identity, password });
  const res = await fetch(ST_LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const multi =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  const parts: string[] = [];
  for (const sc of multi) {
    const first = sc.split(";")[0]?.trim();
    if (first) parts.push(first);
  }
  if (parts.length) return [...new Set(parts)].join("; ");
  const single = res.headers.get("Set-Cookie");
  if (single) {
    return single
      .split(/,(?=[^;]+?=)/)
      .map((c) => c.split(";")[0]!.trim())
      .join("; ");
  }
  return null;
}

/** Fetch GP JSON for a Space-Track query path (after `query/`). */
export async function fetchSpaceTrackGp(
  cookie: string,
  queryPath: string
): Promise<CatalogRecord[]> {
  const url = `https://www.space-track.org/basicspacedata/query/${queryPath}`;
  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      "User-Agent": "sat-kt3i-com-web/1.0 (worker)",
    },
  });
  if (!res.ok) throw new Error(`Space-Track HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  const out: CatalogRecord[] = [];
  for (const row of data) {
    const p = OmmRecordSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}
