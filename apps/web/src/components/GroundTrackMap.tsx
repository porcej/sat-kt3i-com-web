import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PassTrackPoint } from "@/lib/passes";
import { cn } from "@/lib/utils";

const OBS_SRC = "observer-pt";
const PASS_SRC = "pass-line";

function applyLayers(
  map: maplibregl.Map,
  observerLat: number,
  observerLon: number,
  track: PassTrackPoint[]
) {
  if (map.getLayer("pass-line-layer")) map.removeLayer("pass-line-layer");
  if (map.getSource(PASS_SRC)) map.removeSource(PASS_SRC);
  if (map.getLayer("observer-layer")) map.removeLayer("observer-layer");
  if (map.getSource(OBS_SRC)) map.removeSource(OBS_SRC);

  const coords = track.map((p) => [p.lonDeg, p.latDeg] as [number, number]);
  if (coords.length >= 2) {
    map.addSource(PASS_SRC, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      },
    });
    map.addLayer({
      id: "pass-line-layer",
      type: "line",
      source: PASS_SRC,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 3,
      },
    });
  }

  map.addSource(OBS_SRC, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [observerLon, observerLat],
      },
    },
  });
  map.addLayer({
    id: "observer-layer",
    type: "circle",
    source: OBS_SRC,
    paint: {
      "circle-radius": 7,
      "circle-color": "#ef4444",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([observerLon, observerLat]);
  for (const p of track) bounds.extend([p.lonDeg, p.latDeg]);
  if (coords.length >= 1) {
    map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 600 });
  }
}

export function GroundTrackMap({
  observerLat,
  observerLon,
  track,
  className,
}: {
  observerLat: number;
  observerLon: number;
  track: PassTrackPoint[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [observerLon, observerLat],
      zoom: 3,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => {
      applyLayers(map, observerLat, observerLon, track);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.loaded()) return;
    applyLayers(map, observerLat, observerLon, track);
  }, [observerLat, observerLon, track]);

  return (
    <div
      ref={ref}
      className={cn("h-[280px] w-full overflow-hidden rounded-lg border", className)}
    />
  );
}
