import { describe, expect, it } from "vitest";
import { mergeTleFromBulletinText } from "./upstream.js";

describe("mergeTleFromBulletinText", () => {
  it("adds TLE lines to GP records missing them", () => {
    const bulletin = `ISS (ZARYA)
1 25544U 98067A   26133.42450843  .00004829  00000+0  95080-4 0  9993
2 25544  51.6310 112.1825 0007522  54.1994 305.9693 15.49203550566361`;
    const sats = [
      {
        OBJECT_NAME: "ISS (ZARYA)",
        EPOCH: "2026-05-13T10:11:17.528352",
        MEAN_MOTION: 15.49,
        ECCENTRICITY: 0.00075,
        INCLINATION: 51.63,
        RA_OF_ASC_NODE: 112.18,
        ARG_OF_PERICENTER: 54.2,
        MEAN_ANOMALY: 305.97,
        NORAD_CAT_ID: 25544,
        BSTAR: 1e-4,
        MEAN_MOTION_DOT: 1e-5,
      },
    ];
    const merged = mergeTleFromBulletinText(sats, bulletin);
    expect(merged[0]).toMatchObject({
      NORAD_CAT_ID: 25544,
      TLE_LINE1: expect.stringContaining("25544"),
      TLE_LINE2: expect.stringContaining("25544"),
    });
  });
});
