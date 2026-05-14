import * as sat from "satellite.js";
import type { Observer } from "./passes";
import { satelliteIlluminationAt } from "./sunIllumination";

export type PassSnap = {
  time: Date;
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
  illumination: "Sunlit" | "Penumbra" | "Umbra";
  dopplerFactor: number;
};

function observerGeodetic(observer: Observer): sat.GeodeticLocation {
  return {
    latitude: sat.degreesToRadians(observer.latDeg),
    longitude: sat.degreesToRadians(observer.lonDeg),
    height: observer.altKm,
  };
}

export function snapPassAt(
  satrec: sat.SatRec,
  observer: Observer,
  date: Date
): PassSnap | null {
  const pv = sat.propagate(satrec, date);
  if (
    !pv.position ||
    typeof pv.position === "boolean" ||
    !pv.velocity ||
    typeof pv.velocity === "boolean"
  ) {
    return null;
  }
  const gmst = sat.gstime(date);
  const posEcf = sat.eciToEcf(pv.position, gmst);
  const velEcf = sat.eciToEcf(pv.velocity, gmst);
  const obsGd = observerGeodetic(observer);
  const obsEcf = sat.geodeticToEcf(obsGd);
  const look = sat.ecfToLookAngles(obsGd, posEcf);
  const dopplerFactor = sat.dopplerFactor(obsEcf, posEcf, velEcf);
  const illumination = satelliteIlluminationAt(pv.position, date);
  return {
    time: date,
    elevationDeg: (look.elevation * 180) / Math.PI,
    azimuthDeg: (look.azimuth * 180) / Math.PI,
    rangeKm: look.rangeSat,
    illumination,
    dopplerFactor,
  };
}

/** Doppler-adjusted frequency (MHz). Downlink: multiply nominal; uplink: divide (common LEO convention). */
export function dopplerShiftedMHz(
  nominalMHz: number,
  dopplerFactor: number,
  link: "uplink" | "downlink"
): number {
  if (link === "downlink") return nominalMHz * dopplerFactor;
  return nominalMHz / dopplerFactor;
}
