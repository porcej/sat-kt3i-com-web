import type { PassTrackPoint } from "@/lib/passes";
import { cn } from "@/lib/utils";

/** North-up: azimuth clockwise from north; zenith at center. */
function project(azDeg: number, elDeg: number, cx: number, cy: number, rMax: number) {
  const az = (azDeg * Math.PI) / 180;
  const r = ((90 - elDeg) / 90) * rMax;
  return {
    x: cx + r * Math.sin(az),
    y: cy - r * Math.cos(az),
  };
}

export function SkyPlot({
  track,
  className,
}: {
  track: PassTrackPoint[];
  className?: string;
}) {
  const cx = 110;
  const cy = 110;
  const rMax = 95;

  const rings = [0, 30, 60];
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];

  const path =
    track.length > 0
      ? track
          .map((p, i) => {
            const { x, y } = project(p.azDeg, p.elDeg, cx, cy, rMax);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ")
      : "";

  return (
    <svg
      viewBox="0 0 220 220"
      className={cn("h-[260px] w-full text-muted-foreground", className)}
      role="img"
      aria-label="Sky plot of satellite pass"
    >
      <circle cx={cx} cy={cy} r={rMax} fill="none" stroke="currentColor" strokeWidth="1" />
      {rings.map((el) => {
        const rr = ((90 - el) / 90) * rMax;
        return (
          <circle
            key={el}
            cx={cx}
            cy={cy}
            r={rr}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
        );
      })}
      {spokes.map((deg) => {
        const p = project(deg, 0, cx, cy, rMax);
        return (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeWidth="0.5"
          />
        );
      })}
      <text x={cx} y={14} textAnchor="middle" className="fill-foreground text-[11px]">
        N
      </text>
      <text x={210} y={cy + 4} textAnchor="end" className="fill-foreground text-[11px]">
        E
      </text>
      <text x={cx} y={215} textAnchor="middle" className="fill-foreground text-[11px]">
        S
      </text>
      <text x={8} y={cy + 4} className="fill-foreground text-[11px]">
        W
      </text>
      {path ? (
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
