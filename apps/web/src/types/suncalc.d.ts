declare module "suncalc" {
  export function getPosition(
    date: Date,
    latitude: number,
    longitude: number
  ): { azimuth: number; altitude: number };
}
