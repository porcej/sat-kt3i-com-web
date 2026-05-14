import { describe, expect, it } from "vitest";
import { predictPasses } from "./passes";

const issOmm = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-05-13T10:11:17.528352",
  MEAN_MOTION: 15.4920355,
  ECCENTRICITY: 0.0007522,
  INCLINATION: 51.631,
  RA_OF_ASC_NODE: 112.1825,
  ARG_OF_PERICENTER: 54.1994,
  MEAN_ANOMALY: 305.9693,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 56636,
  BSTAR: 9.508e-5,
  MEAN_MOTION_DOT: 4.829e-5,
  MEAN_MOTION_DDOT: 0,
  TLE_LINE1:
    "1 25544U 98067A   26133.42450843  .00004829  00000+0  95080-4 0  9993",
  TLE_LINE2:
    "2 25544  51.6310 112.1825 0007522  54.1994 305.9693 15.49203550566361",
} as const;

describe("predictPasses", () => {
  it("returns at least one pass for ISS from NYC with merged TLE", () => {
    const observer = { latDeg: 40.7128, lonDeg: -74.006, altKm: 0 };
    const passes = predictPasses(issOmm, observer, {
      horizonDays: 3,
      minElDeg: 10,
      stepSec: 30,
    });
    expect(passes.length).toBeGreaterThan(0);
    expect(passes[0]!.maxElDeg).toBeGreaterThan(10);
  });

  it("uses explicit window start/end instead of horizon from now", () => {
    const observer = { latDeg: 40.7128, lonDeg: -74.006, altKm: 0 };
    const winStart = new Date("2026-05-13T00:00:00.000Z");
    const winEnd = new Date("2026-05-16T23:59:59.000Z");
    const passes = predictPasses(issOmm, observer, {
      windowStart: winStart,
      windowEnd: winEnd,
      minElDeg: 10,
      stepSec: 30,
    });
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      expect(p.aos.getTime()).toBeGreaterThanOrEqual(winStart.getTime());
      expect(p.aos.getTime()).toBeLessThanOrEqual(winEnd.getTime() + 30_000);
    }
  });
});
