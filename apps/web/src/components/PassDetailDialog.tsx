import * as sat from "satellite.js";
import type { CatalogRecord } from "@sat/shared";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getHamSatelliteInfo,
  type HamSatelliteService,
} from "@/lib/hamSatelliteCatalog";
import type { Observer, PassEvent } from "@/lib/passes";
import { dopplerShiftedMHz, snapPassAt } from "@/lib/passSnap";

function fmtWhen(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function fmtUtcIso(d: Date) {
  return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function fmtPlTones(svc: HamSatelliteService): string {
  const parts: string[] = [];
  if (svc.uplinkToneHz != null) parts.push(`Uplink ${svc.uplinkToneHz} Hz`);
  if (svc.downlinkToneHz != null) parts.push(`Downlink ${svc.downlinkToneHz} Hz`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function illumBadge(state: string) {
  if (state === "Sunlit") {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
      >
        Sunlit
      </Badge>
    );
  }
  if (state === "Penumbra") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-600/15 text-amber-800 dark:text-amber-300"
      >
        Penumbra
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-violet-600/15 text-violet-800 dark:text-violet-300"
    >
      Umbra (eclipse)
    </Badge>
  );
}

export type PassDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pass: PassEvent;
  record: CatalogRecord;
  observer: Observer;
  groupId: string;
};

export function PassDetailDialog({
  open,
  onOpenChange,
  pass,
  record,
  observer,
  groupId,
}: PassDetailDialogProps) {
  const satrec =
    "TLE_LINE1" in record && record.TLE_LINE1 && record.TLE_LINE2
      ? sat.twoline2satrec(record.TLE_LINE1, record.TLE_LINE2)
      : null;

  const aosSnap = satrec ? snapPassAt(satrec, observer, pass.aos) : null;
  const tcaSnap = satrec ? snapPassAt(satrec, observer, pass.tca) : null;
  const losSnap = satrec ? snapPassAt(satrec, observer, pass.los) : null;

  const ham = getHamSatelliteInfo(pass.noradId);
  const rows = [
    { label: "AOS", snap: aosSnap },
    { label: "TCA", snap: tcaSnap },
    { label: "LOS", snap: losSnap },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pass detail — {pass.name}</DialogTitle>
          <DialogDescription>
            NORAD {pass.noradId} · Observer {observer.latDeg.toFixed(4)}° lat,{" "}
            {observer.lonDeg.toFixed(4)}° lon, {observer.altKm} km AMSL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {!satrec ? (
            <p className="text-destructive">
              TLE lines missing — cannot compute geometry for this catalog entry.
            </p>
          ) : (
            <>
              <div>
                <h4 className="mb-2 font-medium">Geometry and illumination</h4>
                <p className="mb-3 text-muted-foreground">
                  <strong>Sunlit</strong> means the satellite is likely illuminated by the Sun;{" "}
                  <strong>Penumbra</strong> is a transition region;{" "}
                  <strong>Umbra</strong> means likely in Earth shadow (eclipse). Model is
                  approximate (point Sun, limb geometry); not a substitute for mission ops data.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>El</TableHead>
                      <TableHead>Az</TableHead>
                      <TableHead>Range</TableHead>
                      <TableHead>Sun / shadow</TableHead>
                      <TableHead>Doppler factor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ label, snap }) => (
                      <TableRow key={label}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {snap ? fmtWhen(snap.time) : "—"}
                        </TableCell>
                        <TableCell>
                          {snap ? `${snap.elevationDeg.toFixed(1)} deg` : "—"}
                        </TableCell>
                        <TableCell>
                          {snap ? `${snap.azimuthDeg.toFixed(0)} deg` : "—"}
                        </TableCell>
                        <TableCell>
                          {snap ? `${snap.rangeKm.toFixed(0)} km` : "—"}
                        </TableCell>
                        <TableCell>
                          {snap ? illumBadge(snap.illumination) : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {snap ? snap.dopplerFactor.toFixed(7) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {ham ? (
                <div>
                  <h4 className="mb-2 font-medium">Amateur radio (catalog)</h4>
                  <p className="mb-3 text-muted-foreground">
                    Nominal values below are from a small local catalog — confirm with{" "}
                    <a
                      className="text-primary underline"
                      href="https://www.amsat.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      AMSAT
                    </a>{" "}
                    and your licence before transmitting. Doppler: downlink uses{" "}
                    <code className="rounded bg-muted px-1">nominal x factor</code>, uplink uses{" "}
                    <code className="rounded bg-muted px-1">nominal / factor</code> (satellite.js
                    line-of-sight model).
                  </p>
                  {ham.notes ? (
                    <p className="mb-4 text-muted-foreground">{ham.notes}</p>
                  ) : null}

                  <ol className="list-none space-y-4 p-0">
                    {ham.services.map((svc, i) => (
                      <li
                        key={`${svc.label}-${i}`}
                        className="rounded-lg border bg-muted/30 p-4"
                      >
                        <h5 className="mb-3 text-base font-semibold leading-tight">
                          <span className="text-muted-foreground">{i + 1}. </span>
                          {svc.label}
                        </h5>
                        <dl className="mb-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">Mode</dt>
                            <dd className="font-medium">{svc.modes}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">PL / tone</dt>
                            <dd className="font-medium">{fmtPlTones(svc)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Nominal uplink</dt>
                            <dd className="font-medium">
                              {svc.uplinkMHz != null ? `${svc.uplinkMHz} MHz` : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Nominal downlink</dt>
                            <dd className="font-medium">
                              {svc.downlinkMHz != null ? `${svc.downlinkMHz} MHz` : "—"}
                            </dd>
                          </div>
                        </dl>
                        {svc.notes ? (
                          <p className="mb-3 text-muted-foreground">{svc.notes}</p>
                        ) : null}

                        <h6 className="mb-2 text-sm font-medium">
                          Doppler-corrected frequencies (MHz)
                        </h6>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Downlink (hear)</TableHead>
                              <TableHead>Uplink (transmit)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map(({ label, snap }) => (
                              <TableRow key={`dop-${svc.label}-${label}`}>
                                <TableCell className="font-medium">{label}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {snap &&
                                  svc.downlinkMHz != null &&
                                  svc.downlinkMHz > 0
                                    ? dopplerShiftedMHz(
                                        svc.downlinkMHz,
                                        snap.dopplerFactor,
                                        "downlink"
                                      ).toFixed(4)
                                    : "—"}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {snap && svc.uplinkMHz != null && svc.uplinkMHz > 0
                                    ? dopplerShiftedMHz(
                                        svc.uplinkMHz,
                                        snap.dopplerFactor,
                                        "uplink"
                                      ).toFixed(4)
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : groupId === "amateur" ? (
                <p className="text-muted-foreground">
                  This satellite is in the <strong>amateur</strong> group, but there is no extended
                  mode / frequency entry in the app catalog yet. Add NORAD {pass.noradId} to{" "}
                  <code className="rounded bg-muted px-1">hamSatelliteCatalog.ts</code> to show
                  modes, PL tones, and Doppler-shifted frequencies here.
                </p>
              ) : null}
            </>
          )}

          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">UTC (ISO) times</p>
            <p>AOS {fmtUtcIso(pass.aos)}</p>
            <p>TCA {fmtUtcIso(pass.tca)}</p>
            <p>LOS {fmtUtcIso(pass.los)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
