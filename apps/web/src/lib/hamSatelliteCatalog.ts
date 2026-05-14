/**
 * Curated amateur-radio transponder / repeater hints (nominal frequencies, modes, PL).
 * NORAD IDs and parameters change — always verify with AMSAT / official sources before transmitting.
 */

/** One radio service on a satellite (repeater, digipeater, linear pass, etc.). */
export type HamSatelliteService = {
  /** Short name, e.g. "V/U repeater", "APRS digipeater" */
  label: string;
  modes: string;
  /** Nominal uplink centre (MHz); null if RX-only or N/A */
  uplinkMHz: number | null;
  /** Nominal downlink centre (MHz); null if TX-only or N/A */
  downlinkMHz: number | null;
  /** Access PL on uplink (Hz), if applicable */
  uplinkToneHz: number | null;
  /** PL on downlink (Hz), rarely used */
  downlinkToneHz: number | null;
  notes?: string;
};

export type HamSatelliteInfo = {
  noradId: number;
  name: string;
  /** One or more services (repeaters, digis, linear bands, etc.). */
  services: HamSatelliteService[];
  /** Optional note applying to the whole satellite */
  notes?: string;
};

const CATALOG: HamSatelliteInfo[] = [
  {
    noradId: 25544,
    name: "ISS",
    notes: "ARISS schedules and regional policies change often — confirm before transmitting.",
    services: [
      {
        label: "V/U FM repeater (crossband)",
        modes: "FM",
        uplinkMHz: 145.99,
        downlinkMHz: 437.8,
        uplinkToneHz: null,
        downlinkToneHz: null,
        notes: "Typical crossband pair; verify current voice/repeater status with ARISS.",
      },
      {
        label: "APRS digipeater",
        modes: "APRS (1200 baud AFSK)",
        uplinkMHz: 145.825,
        downlinkMHz: 145.825,
        uplinkToneHz: null,
        downlinkToneHz: null,
        notes: "Common simplex packet frequency for RS0ISS; confirm baud and path with current bulletins.",
      },
    ],
  },
  {
    noradId: 27607,
    name: "SO-50",
    services: [
      {
        label: "FM transponder",
        modes: "FM",
        uplinkMHz: 145.85,
        downlinkMHz: 436.795,
        uplinkToneHz: 67.0,
        downlinkToneHz: null,
        notes: "67.0 Hz PL required on uplink.",
      },
    ],
  },
  {
    noradId: 43880,
    name: "AO-92",
    services: [
      {
        label: "FM transponder",
        modes: "FM",
        uplinkMHz: 145.88,
        downlinkMHz: 435.35,
        uplinkToneHz: 67.0,
        downlinkToneHz: null,
        notes: "Verify current transponder plan on AMSAT.",
      },
    ],
  },
  {
    noradId: 39440,
    name: "AO-73",
    services: [
      {
        label: "Linear transponder",
        modes: "Linear / CW / digi",
        uplinkMHz: 435.15,
        downlinkMHz: 145.96,
        uplinkToneHz: null,
        downlinkToneHz: null,
        notes: "Doppler shift is large — track pass carefully.",
      },
    ],
  },
  {
    noradId: 40119,
    name: "FO-29",
    services: [
      {
        label: "Linear transponder",
        modes: "Linear (SSB/CW)",
        uplinkMHz: 435.05,
        downlinkMHz: 145.95,
        uplinkToneHz: null,
        downlinkToneHz: null,
        notes: "Check band edges for your licence class.",
      },
    ],
  },
  {
    noradId: 59110,
    name: "RS-44",
    services: [
      {
        label: "Linear transponder",
        modes: "Linear",
        uplinkMHz: 435.05,
        downlinkMHz: 145.95,
        uplinkToneHz: null,
        downlinkToneHz: null,
        notes: "Confirm current operating schedule.",
      },
    ],
  },
  {
    noradId: 58294,
    name: "IO-117",
    services: [
      {
        label: "Main transponder",
        modes: "FM / digital",
        uplinkMHz: 435.18,
        downlinkMHz: 145.88,
        uplinkToneHz: 67.0,
        downlinkToneHz: null,
        notes: "GreenCube / mixed modes; verify current configuration.",
      },
    ],
  },
];

const byNorad = new Map<number, HamSatelliteInfo>(
  CATALOG.map((e) => [e.noradId, e])
);

export function getHamSatelliteInfo(noradId: number): HamSatelliteInfo | null {
  return byNorad.get(noradId) ?? null;
}

/** True when we have extended ham-radio metadata for this NORAD ID. */
export function hasHamCatalogEntry(noradId: number): boolean {
  return byNorad.has(noradId);
}
