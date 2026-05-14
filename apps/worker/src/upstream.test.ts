import { describe, expect, it } from "vitest";
import { parseTleBulletin } from "./upstream.js";

describe("parseTleBulletin", () => {
  it("parses name + two lines", () => {
    const text = `ISS (ZARYA)
1 25544U 98067A   24134.56789012  .00016717  00000+0  10270-3 0  9990
2 25544  51.6416  47.4623 0006063  17.2684  342.7678 15.54225989 34567`;
    const rows = parseTleBulletin(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.NORAD_CAT_ID).toBe(25544);
    expect(rows[0]!.OBJECT_NAME).toContain("ISS");
    expect(rows[0]!.TLE_LINE1.startsWith("1 ")).toBe(true);
    expect(rows[0]!.TLE_LINE2.startsWith("2 ")).toBe(true);
  });
});
