import type { SatelliteGroup } from "@sat/shared";

/** Curated catalog: CelesTrak GP `GROUP` values and optional AMSAT TLE URLs. */
export const CURATED_GROUPS: SatelliteGroup[] = [
  {
    id: "stations",
    label: "Space stations",
    description: "ISS, Tiangong, etc.",
    source: "celestrak",
    celestrakGroup: "stations",
  },
  {
    id: "visual",
    label: "100 brightest",
    source: "celestrak",
    celestrakGroup: "visual",
  },
  {
    id: "weather",
    label: "Weather & Earth resources",
    source: "celestrak",
    celestrakGroup: "weather",
  },
  {
    id: "noaa",
    label: "NOAA",
    source: "celestrak",
    celestrakGroup: "noaa",
  },
  {
    id: "goes",
    label: "GOES",
    source: "celestrak",
    celestrakGroup: "goes",
  },
  {
    id: "gps-ops",
    label: "GPS operational",
    source: "celestrak",
    celestrakGroup: "gps-ops",
  },
  {
    id: "starlink",
    label: "Starlink",
    source: "celestrak",
    celestrakGroup: "starlink",
  },
  {
    id: "amateur",
    label: "Amateur radio",
    source: "celestrak",
    celestrakGroup: "amateur",
  },
  {
    id: "iridium",
    label: "Iridium",
    source: "celestrak",
    celestrakGroup: "iridium",
  },
  {
    id: "amsat-nasa-all",
    label: "AMSAT (NASA all)",
    description: "Raw TLE bulletin from AMSAT",
    source: "amsat",
    tleUrl: "https://www.amsat.org/tle/current/nasa.all",
  },
  {
    id: "iss-spacetrack",
    label: "ISS (Space-Track)",
    description: "Requires SPACE_TRACK_USER / SPACE_TRACK_PASSWORD secrets",
    source: "space-track",
    spaceTrackQuery: "class/gp/NORAD_CAT_ID/25544/format/json",
  },
];

export const HOT_GROUPS_FOR_CRON = [
  "stations",
  "visual",
  "amateur",
  "starlink",
  "weather",
];

export function getGroupById(id: string): SatelliteGroup | undefined {
  return CURATED_GROUPS.find((g) => g.id === id);
}
