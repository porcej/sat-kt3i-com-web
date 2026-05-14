import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  Navigation,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PassDetailDialog } from "@/components/PassDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePersistedState } from "@/hooks/usePersistedState";
import { fetchGroups, fetchTle } from "@/lib/api";
import {
  downloadBatchPassesCsv,
  downloadBatchPassesPdf,
  downloadBatchPassesXlsx,
  type BatchPassExportMeta,
} from "@/lib/exportPredictions";
import {
  PREDICT_MAX_WINDOW_MS,
  predictPasses,
  type Observer,
  type PassEvent,
} from "@/lib/passes";
import type { CatalogRecord } from "@sat/shared";

type SavedLocation = {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  altKm: number;
};

type BatchPassRow = {
  pass: PassEvent;
  record: CatalogRecord;
};

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultWindowStrings() {
  const start = new Date();
  const end = new Date(start.getTime() + 7 * 86400000);
  return { startStr: toLocalDatetimeValue(start), endStr: toLocalDatetimeValue(end) };
}

function formatTime(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

const MAX_SELECTED_SATS = 40;

type BatchRunContext = {
  windowStart: Date;
  windowEnd: Date;
  minElDeg: number;
  selectedSatelliteCount: number;
};

export default function BatchPassesPage() {
  const init = useMemo(() => defaultWindowStrings(), []);
  const [groupId, setGroupId] = useState("stations");
  const [search, setSearch] = useState("");
  const [minEl, setMinEl] = useState(10);
  const [windowStartStr, setWindowStartStr] = useState(init.startStr);
  const [windowEndStr, setWindowEndStr] = useState(init.endStr);
  const [selectedNorads, setSelectedNorads] = useState<number[]>([]);
  const [generated, setGenerated] = useState<BatchPassRow[] | null>(null);
  const [batchRunContext, setBatchRunContext] = useState<BatchRunContext | null>(
    null
  );
  const [genError, setGenError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<BatchPassRow | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [observer, setObserver] = usePersistedState<Observer & { label?: string }>(
    "sat:observer-v1",
    { latDeg: 40.7128, lonDeg: -74.006, altKm: 0, label: "New York" }
  );

  const [savedLocs, setSavedLocs] = usePersistedState<SavedLocation[]>(
    "sat:saved-locations-v1",
    []
  );

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
    staleTime: 60 * 60 * 1000,
  });

  const tleQ = useQuery({
    queryKey: ["tle", groupId],
    queryFn: () => fetchTle(groupId),
    staleTime: 5 * 60 * 1000,
  });

  const observerModel: Observer = useMemo(
    () => ({
      latDeg: observer.latDeg,
      lonDeg: observer.lonDeg,
      altKm: observer.altKm,
    }),
    [observer.latDeg, observer.lonDeg, observer.altKm]
  );

  const filteredSats = useMemo(() => {
    const list = tleQ.data?.satellites ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => {
      const name = s.OBJECT_NAME.toLowerCase();
      return name.includes(q) || String(s.NORAD_CAT_ID).includes(q);
    });
  }, [tleQ.data?.satellites, search]);

  const batchExportMeta: BatchPassExportMeta | null = useMemo(() => {
    if (!generated?.length || !batchRunContext) return null;
    const groupLabel = groupsQ.data?.groups.find((g) => g.id === groupId)?.label;
    return {
      observerLat: observerModel.latDeg,
      observerLon: observerModel.lonDeg,
      observerAltKm: observerModel.altKm,
      minElDeg: batchRunContext.minElDeg,
      windowStartUtc: batchRunContext.windowStart.toISOString(),
      windowEndUtc: batchRunContext.windowEnd.toISOString(),
      groupId,
      groupLabel,
      selectedSatelliteCount: batchRunContext.selectedSatelliteCount,
    };
  }, [
    generated,
    batchRunContext,
    observerModel.latDeg,
    observerModel.lonDeg,
    observerModel.altKm,
    groupId,
    groupsQ.data?.groups,
  ]);

  function toggleNorad(id: number) {
    setSelectedNorads((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTED_SATS) return prev;
      return [...prev, id];
    });
  }

  function selectAllFiltered() {
    const ids = filteredSats.map((s) => s.NORAD_CAT_ID).slice(0, MAX_SELECTED_SATS);
    setSelectedNorads(ids);
  }

  function clearSelection() {
    setSelectedNorads([]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObserver({
          latDeg: pos.coords.latitude,
          lonDeg: pos.coords.longitude,
          altKm: (pos.coords.altitude ?? 0) / 1000,
          label: "Browser location",
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    );
  }

  function saveCurrentLocation() {
    const id = crypto.randomUUID();
    const label = observer.label?.trim() || "Saved location";
    setSavedLocs((prev) => {
      const next: SavedLocation[] = [
        {
          id,
          label,
          latDeg: observer.latDeg,
          lonDeg: observer.lonDeg,
          altKm: observer.altKm,
        },
        ...prev.filter((p) => p.label !== label),
      ].slice(0, 8);
      return next;
    });
  }

  function runGenerate() {
    setGenError(null);
    const ws = new Date(windowStartStr);
    const we = new Date(windowEndStr);
    if (Number.isNaN(ws.getTime()) || Number.isNaN(we.getTime())) {
      setGenError("Start and end must be valid dates.");
      return;
    }
    if (we.getTime() <= ws.getTime()) {
      setGenError("End time must be after start time.");
      return;
    }
    if (we.getTime() - ws.getTime() > PREDICT_MAX_WINDOW_MS) {
      setGenError(
        `Maximum window is ${PREDICT_MAX_WINDOW_MS / 86400000} days. Narrow the range.`
      );
      return;
    }
    if (selectedNorads.length === 0) {
      setGenError("Select at least one satellite.");
      return;
    }
    const byNorad = new Map(
      (tleQ.data?.satellites ?? []).map((s) => [s.NORAD_CAT_ID, s])
    );
    const rows: BatchPassRow[] = [];
    for (const id of selectedNorads) {
      const record = byNorad.get(id);
      if (!record) continue;
      const passes = predictPasses(record, observerModel, {
        windowStart: ws,
        windowEnd: we,
        minElDeg: minEl,
        stepSec: 30,
      });
      for (const p of passes) {
        rows.push({ pass: p, record });
      }
    }
    rows.sort((a, b) => a.pass.aos.getTime() - b.pass.aos.getTime());
    if (rows.length === 0) {
      setBatchRunContext(null);
    } else {
      setBatchRunContext({
        windowStart: ws,
        windowEnd: we,
        minElDeg: minEl,
        selectedSatelliteCount: selectedNorads.length,
      });
    }
    setGenerated(rows);
  }

  return (
    <AppShell
      pageTitle="Batch pass predictions"
      pageDescription="Choose satellites, a time window, and minimum elevation — one combined table sorted by AOS."
    >
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Observer</CardTitle>
            <CardDescription>
              Same saved location as the dashboard (shared storage key).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={useMyLocation}>
                <Navigation className="mr-2 h-4 w-4" />
                Use my location
              </Button>
              <Button type="button" variant="secondary" onClick={saveCurrentLocation}>
                <MapPin className="mr-2 h-4 w-4" />
                Save location
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-lat">Latitude</Label>
                <Input
                  id="batch-lat"
                  inputMode="decimal"
                  value={String(observer.latDeg)}
                  onChange={(e) =>
                    setObserver((o) => ({
                      ...o,
                      latDeg: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-lon">Longitude</Label>
                <Input
                  id="batch-lon"
                  inputMode="decimal"
                  value={String(observer.lonDeg)}
                  onChange={(e) =>
                    setObserver((o) => ({
                      ...o,
                      lonDeg: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-alt">Altitude (km)</Label>
                <Input
                  id="batch-alt"
                  inputMode="decimal"
                  value={String(observer.altKm)}
                  onChange={(e) =>
                    setObserver((o) => ({
                      ...o,
                      altKm: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-label">Label</Label>
                <Input
                  id="batch-label"
                  value={observer.label ?? ""}
                  placeholder="Home, grid, …"
                  onChange={(e) =>
                    setObserver((o) => ({ ...o, label: e.target.value }))
                  }
                />
              </div>
            </div>
            {savedLocs.length > 0 ? (
              <div className="space-y-2">
                <Label>Saved / recent</Label>
                <div className="flex flex-wrap gap-2">
                  {savedLocs.map((loc) => (
                    <Button
                      key={loc.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setObserver({
                          latDeg: loc.latDeg,
                          lonDeg: loc.lonDeg,
                          altKm: loc.altKm,
                          label: loc.label,
                        })
                      }
                    >
                      {loc.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Satellites</CardTitle>
            <CardDescription>
              Multi-select (max {MAX_SELECTED_SATS}). Uses the same TLE group feed as the
              dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-group">Group</Label>
                <select
                  id="batch-group"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setSelectedNorads([]);
                    setGenerated(null);
                    setBatchRunContext(null);
                  }}
                >
                  {(groupsQ.data?.groups ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-search">Search</Label>
                <Input
                  id="batch-search"
                  placeholder="Name or NORAD ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={selectAllFiltered}>
                Select all (filtered, cap {MAX_SELECTED_SATS})
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                Clear selection
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedNorads.length} selected
              </span>
            </div>
            <Separator />
            <div className="max-h-[360px] space-y-0 overflow-auto rounded-md border">
              {tleQ.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Loading catalog…</p>
              ) : tleQ.isError ? (
                <p className="p-3 text-sm text-destructive">
                  {(tleQ.error as Error).message}
                </p>
              ) : (
                filteredSats.map((s) => {
                  const checked = selectedNorads.includes(s.NORAD_CAT_ID);
                  return (
                    <label
                      key={s.NORAD_CAT_ID}
                      className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 rounded border-input"
                        checked={checked}
                        onChange={() => toggleNorad(s.NORAD_CAT_ID)}
                        disabled={
                          !checked && selectedNorads.length >= MAX_SELECTED_SATS
                        }
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {s.OBJECT_NAME}
                      </span>
                      <Badge variant="secondary">{s.NORAD_CAT_ID}</Badge>
                    </label>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Window and elevation</CardTitle>
            <CardDescription>
              Times use your browser's local timezone. Maximum span{" "}
              {PREDICT_MAX_WINDOW_MS / 86400000} days (SGP4 steps every 30 s per satellite).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batch-start">Start</Label>
                <Input
                  id="batch-start"
                  type="datetime-local"
                  value={windowStartStr}
                  onChange={(e) => setWindowStartStr(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-end">End</Label>
                <Input
                  id="batch-end"
                  type="datetime-local"
                  value={windowEndStr}
                  onChange={(e) => setWindowEndStr(e.target.value)}
                />
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="batch-minel">Minimum elevation (°)</Label>
              <Input
                id="batch-minel"
                type="number"
                min={0}
                max={90}
                value={minEl}
                onChange={(e) =>
                  setMinEl(Number.parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
            {genError ? (
              <p className="text-sm text-destructive">{genError}</p>
            ) : null}
            <Button type="button" onClick={runGenerate}>
              Generate table
            </Button>
          </CardContent>
        </Card>

        {generated && generated.length > 0 ? (
          <Card className="min-w-0">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="min-w-0 flex-1 space-y-1.5">
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {generated.length} pass
                  {generated.length === 1 ? "" : "es"} — click a row for details (illumination,
                  Doppler, ham catalog when available).
                </CardDescription>
              </div>
              {batchExportMeta ? (
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportBusy}
                      onClick={() => {
                        setExportError(null);
                        try {
                          downloadBatchPassesCsv(
                            generated.map((r) => r.pass),
                            batchExportMeta
                          );
                        } catch (e) {
                          setExportError(
                            e instanceof Error ? e.message : "CSV export failed"
                          );
                        }
                      }}
                    >
                      <FileText className="mr-1.5 h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportBusy}
                      onClick={async () => {
                        setExportError(null);
                        setExportBusy(true);
                        try {
                          await downloadBatchPassesXlsx(
                            generated.map((r) => r.pass),
                            batchExportMeta
                          );
                        } catch (e) {
                          setExportError(
                            e instanceof Error ? e.message : "Excel export failed"
                          );
                        } finally {
                          setExportBusy(false);
                        }
                      }}
                    >
                      <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                      Excel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportBusy}
                      onClick={async () => {
                        setExportError(null);
                        setExportBusy(true);
                        try {
                          await downloadBatchPassesPdf(
                            generated.map((r) => r.pass),
                            batchExportMeta
                          );
                        } catch (e) {
                          setExportError(
                            e instanceof Error ? e.message : "PDF export failed"
                          );
                        } finally {
                          setExportBusy(false);
                        }
                      }}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                  {exportBusy ? (
                    <p className="text-xs text-muted-foreground">Preparing file…</p>
                  ) : null}
                  {exportError ? (
                    <p className="max-w-[220px] text-right text-xs text-destructive">
                      {exportError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Satellite</TableHead>
                    <TableHead>AOS</TableHead>
                    <TableHead>TCA</TableHead>
                    <TableHead>LOS</TableHead>
                    <TableHead>Max el</TableHead>
                    <TableHead>Az @ TCA</TableHead>
                    <TableHead>Dur</TableHead>
                    <TableHead>Sky</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generated.map((row, idx) => (
                    <TableRow
                      key={`${row.pass.noradId}-${row.pass.aos.toISOString()}-${idx}`}
                      className="cursor-pointer"
                      onClick={() => setDetailRow(row)}
                    >
                      <TableCell className="min-w-[10rem] font-medium">
                        <span className="block truncate">{row.pass.name}</span>
                        <Badge variant="secondary" className="mt-1 border text-xs">
                          {row.pass.noradId}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(row.pass.aos)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(row.pass.tca)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTime(row.pass.los)}
                      </TableCell>
                      <TableCell>{row.pass.maxElDeg.toFixed(1)}°</TableCell>
                      <TableCell>{row.pass.azTcaDeg.toFixed(0)}°</TableCell>
                      <TableCell>{formatDur(row.pass.durationSec)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.pass.observerSkyHint}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : generated && generated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No passes above {minEl}° for the selected satellites in that window (or missing TLE
            lines).
          </p>
        ) : null}
      </main>

      {detailRow ? (
        <PassDetailDialog
          open
          onOpenChange={(next) => {
            if (!next) setDetailRow(null);
          }}
          pass={detailRow.pass}
          record={detailRow.record}
          observer={observerModel}
          groupId={groupId}
        />
      ) : null}
    </AppShell>
  );
}
