/** Geocentric sun direction (unit) in the same ~equatorial inertial frame as SGP4 TEME/ECI output. Low precision, adequate for eclipse limb checks. */
export function sunUnitVectorEci(date: Date): { x: number; y: number; z: number } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.46 + 0.9856474 * n) % 360) * (Math.PI / 180);
  const g = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const lambda =
    L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const epsilon = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  const x = Math.cos(lambda);
  const y = Math.cos(epsilon) * Math.sin(lambda);
  const z = Math.sin(epsilon) * Math.sin(lambda);
  const m = Math.hypot(x, y, z);
  return { x: x / m, y: y / m, z: z / m };
}

const EARTH_RADIUS_KM = 6378.137;

export type IlluminationState = "Sunlit" | "Penumbra" | "Umbra";

/**
 * Sun / Earth shadow state for a satellite in Earth-centred inertial coordinates (km).
 * Uses a simple Earth-limb vs sun-direction model (sun treated as point at infinity).
 */
export function satelliteIlluminationAt(
  satEciKm: { x: number; y: number; z: number },
  date: Date
): IlluminationState {
  const r = Math.hypot(satEciKm.x, satEciKm.y, satEciKm.z);
  if (!Number.isFinite(r) || r < 100) return "Sunlit";
  const sinrho = EARTH_RADIUS_KM / r;
  const sun = sunUnitVectorEci(date);
  const hx = satEciKm.x / r;
  const hy = satEciKm.y / r;
  const hz = satEciKm.z / r;
  const cosXi = hx * sun.x + hy * sun.y + hz * sun.z;
  if (cosXi > sinrho) return "Sunlit";
  if (cosXi < -sinrho) return "Umbra";
  return "Penumbra";
}
