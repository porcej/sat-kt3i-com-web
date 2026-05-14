import type { CatalogRecord } from "@sat/shared";
import * as sat from "satellite.js";
import * as SunCalc from "suncalc";

export interface Observer {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export interface PassTrackPoint {
  t: Date;
  latDeg: number;
  lonDeg: number;
  elDeg: number;
  azDeg: number;
}

export interface PassEvent {
  noradId: number;
  name: string;
  aos: Date;
  los: Date;
  tca: Date;
  maxElDeg: number;
  azTcaDeg: number;
  durationSec: number;
  observerSkyHint: string;
  track: PassTrackPoint[];
}

function satrecFromCatalog(record: CatalogRecord): sat.SatRec | null {
  if ("TLE_LINE1" in record && record.TLE_LINE1 && record.TLE_LINE2) {
    return sat.twoline2satrec(record.TLE_LINE1, record.TLE_LINE2);
  }
  return null;
}

function observerGeodetic(observer: Observer): sat.GeodeticLocation {
  return {
    latitude: sat.degreesToRadians(observer.latDeg),
    longitude: sat.degreesToRadians(observer.lonDeg),
    height: observer.altKm,
  };
}

function lookAndGeodetic(
  satrec: sat.SatRec,
  observer: Observer,
  date: Date
): {
  elDeg: number;
  azDeg: number;
  latDeg: number;
  lonDeg: number;
} | null {
  const pv = sat.propagate(satrec, date);
  if (!pv.position || typeof pv.position === "boolean") return null;
  const gmst = sat.gstime(date);
  const positionEcf = sat.eciToEcf(pv.position, gmst);
  const observerGd = observerGeodetic(observer);
  const look = sat.ecfToLookAngles(observerGd, positionEcf);
  const geo = sat.eciToGeodetic(pv.position, gmst);
  return {
    elDeg: (look.elevation * 180) / Math.PI,
    azDeg: (look.azimuth * 180) / Math.PI,
    latDeg: sat.degreesLat(geo.latitude),
    lonDeg: sat.degreesLong(geo.longitude),
  };
}

export function observerSkyHint(
  latDeg: number,
  lonDeg: number,
  date: Date
): string {
  const pos = SunCalc.getPosition(date, latDeg, lonDeg);
  const altDeg = (pos.altitude * 180) / Math.PI;
  if (altDeg > 6) return "Day";
  if (altDeg > -6) return "Twilight";
  return "Night";
}

/** Hard cap on prediction window length (avoids freezing the tab on huge ranges). */
export const PREDICT_MAX_WINDOW_MS = 31 * 86400000;

export function predictPasses(
  record: CatalogRecord,
  observer: Observer,
  options?: {
    horizonDays?: number;
    minElDeg?: number;
    stepSec?: number;
    /** When both are set, predictions are limited to this UTC window (inclusive sampling bounds). */
    windowStart?: Date;
    windowEnd?: Date;
  }
): PassEvent[] {
  const horizonDays = options?.horizonDays ?? 10;
  const minElDeg = options?.minElDeg ?? 10;
  const stepSec = options?.stepSec ?? 30;
  const satrec = satrecFromCatalog(record);
  if (!satrec) return [];

  let start: Date;
  let end: Date;
  if (options?.windowStart && options?.windowEnd) {
    start = options.windowStart;
    end = options.windowEnd;
  } else {
    start = new Date();
    end = new Date(start.getTime() + horizonDays * 86400000);
  }
  if (end.getTime() <= start.getTime()) return [];
  const span = end.getTime() - start.getTime();
  if (span > PREDICT_MAX_WINDOW_MS) {
    end = new Date(start.getTime() + PREDICT_MAX_WINDOW_MS);
  }
  const stepMs = stepSec * 1000;

  type Sample = { t: Date; el: number; az: number; lat: number; lon: number };
  const samples: Sample[] = [];

  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const d = new Date(t);
    const lg = lookAndGeodetic(satrec, observer, d);
    if (!lg) continue;
    samples.push({
      t: d,
      el: lg.elDeg,
      az: lg.azDeg,
      lat: lg.latDeg,
      lon: lg.lonDeg,
    });
  }

  const passes: PassEvent[] = [];
  let i = 0;
  while (i < samples.length) {
    while (i < samples.length && samples[i]!.el < minElDeg) i++;
    if (i >= samples.length) break;
    const startIdx = i;
    while (i < samples.length && samples[i]!.el >= minElDeg) i++;
    const endIdx = i - 1;
    const seg = samples.slice(startIdx, endIdx + 1);
    if (seg.length === 0) continue;

    let maxEl = -90;
    let tca = seg[0]!.t;
    let azTca = 0;
    for (const s of seg) {
      if (s.el > maxEl) {
        maxEl = s.el;
        tca = s.t;
        azTca = s.az;
      }
    }

    const aos = seg[0]!.t;
    const los = seg[seg.length - 1]!.t;
    const durationSec = (los.getTime() - aos.getTime()) / 1000;

    const track: PassTrackPoint[] = seg.map((s) => ({
      t: s.t,
      latDeg: s.lat,
      lonDeg: s.lon,
      elDeg: s.el,
      azDeg: s.az,
    }));

    passes.push({
      noradId: record.NORAD_CAT_ID,
      name: record.OBJECT_NAME,
      aos,
      los,
      tca,
      maxElDeg: maxEl,
      azTcaDeg: azTca,
      durationSec,
      observerSkyHint: observerSkyHint(
        observer.latDeg,
        observer.lonDeg,
        tca
      ),
      track,
    });
  }

  return passes;
}
