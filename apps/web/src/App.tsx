import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GroundTrackMap } from "@/components/GroundTrackMap";
import { PassDetailDialog } from "@/components/PassDetailDialog";
import { SkyPlot } from "@/components/SkyPlot";
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
  downloadPassesCsv,
  downloadPassesPdf,
  downloadPassesXlsx,
  type PassExportMeta,
} from "@/lib/exportPredictions";
import { predictPasses, type Observer, type PassEvent } from "@/lib/passes";
import type { CatalogRecord } from "@sat/shared";

type SavedLocation = {
  id: string;
  label: string;
  latDeg: number;
  lonDeg: number;
  altKm: number;
};

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

export default function App() {
  const [groupId, setGroupId] = useState("stations");
  const [search, setSearch] = useState("");
  const [minEl, setMinEl] = useState(10);
  const [horizonDays, setHorizonDays] = useState(7);
  const [selectedNorad, setSelectedNorad] = useState<number | null>(25544);

  const [observer, setObserver] = usePersistedState<Observer & { label?: string }>(
    "sat:observer-v1",
    { latDeg: 40.7128, lonDeg: -74.006, altKm: 0, label: "New York" }
  );

  const [savedLocs, setSavedLocs] = usePersistedState<SavedLocation[]>(
    "sat:saved-locations-v1",
    []
  );

  const [favorites, setFavorites] = usePersistedState<number[]>(
    "sat:favorites-v1",
    [25544]
  );

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [detailPass, setDetailPass] = useState<PassEvent | null>(null);

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
    let rows = q
      ? list.filter((s) => {
          const name = s.OBJECT_NAME.toLowerCase();
          return name.includes(q) || String(s.NORAD_CAT_ID).includes(q);
        })
      : list;
    if (favoritesOnly) {
      rows = rows.filter((s) => favorites.includes(s.NORAD_CAT_ID));
    }
    return rows;
  }, [tleQ.data?.satellites, search, favoritesOnly, favorites]);

  const selectedRecord: CatalogRecord | null = useMemo(() => {
    if (!tleQ.data || selectedNorad == null) return null;
    return (
      tleQ.data.satellites.find((s) => s.NORAD_CAT_ID === selectedNorad) ?? null
    );
  }, [tleQ.data, selectedNorad]);

  const exportMeta: PassExportMeta | null = useMemo(() => {
    if (!selectedRecord) return null;
    return {
      satelliteName: selectedRecord.OBJECT_NAME,
      noradId: selectedRecord.NORAD_CAT_ID,
      observerLat: observer.latDeg,
      observerLon: observer.lonDeg,
      observerAltKm: observer.altKm,
      minElDeg: minEl,
      horizonDays,
    };
  }, [selectedRecord, observer.latDeg, observer.lonDeg, observer.altKm, minEl, horizonDays]);

  const passes: PassEvent[] = useMemo(() => {
    if (!selectedRecord) return [];
    return predictPasses(selectedRecord, observerModel, {
      horizonDays,
      minElDeg: minEl,
      stepSec: 30,
    });
  }, [selectedRecord, observerModel, horizonDays, minEl]);

  const [activePassIdx, setActivePassIdx] = useState(0);

  useEffect(() => {
    setActivePassIdx(0);
  }, [selectedNorad, horizonDays, minEl, observerModel]);

  useEffect(() => {
    setDetailPass(null);
  }, [selectedNorad]);

  const activePass = passes[activePassIdx] ?? passes[0];
  const displayPass = activePass ?? passes[0];

  function toggleFavorite(id: number) {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
      () => {
        /* user denied */
      },
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

  return (
    <AppShell
      pageTitle="Satellite passes"
      pageDescription="Satellite pass predictions by KT3I"
    >
      <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Observer</CardTitle>
              <CardDescription>
                Geolocation or manual coordinates (WGS84). Altitude in kilometers.
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
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
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
                  <Label htmlFor="lon">Longitude</Label>
                  <Input
                    id="lon"
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
                  <Label htmlFor="alt">Altitude (km)</Label>
                  <Input
                    id="alt"
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
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
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
                Group from CelesTrak GP, AMSAT bulletin, or optional Space-Track.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="group">Group</Label>
                  <select
                    id="group"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                    value={groupId}
                    onChange={(e) => {
                      setGroupId(e.target.value);
                      setSelectedNorad(null);
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
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Name or NORAD ID"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={favoritesOnly ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setFavoritesOnly((v) => !v)}
                >
                  <Star className="mr-1 h-4 w-4" />
                  Favorites only
                </Button>
                {tleQ.data?.fetchedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Data fetched {new Date(tleQ.data.fetchedAt).toLocaleString()}
                    {tleQ.data.lastError ? ` · cache note: ${tleQ.data.lastError}` : ""}
                  </span>
                ) : null}
              </div>
              <Separator />
              <div className="max-h-[420px] space-y-1 overflow-auto rounded-md border">
                {tleQ.isLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Loading catalog…</p>
                ) : tleQ.isError ? (
                  <p className="p-3 text-sm text-destructive">
                    {(tleQ.error as Error).message}
                  </p>
                ) : (
                  filteredSats.map((s) => {
                    const active = s.NORAD_CAT_ID === selectedNorad;
                    const fav = favorites.includes(s.NORAD_CAT_ID);
                    return (
                      <div
                        key={s.NORAD_CAT_ID}
                        className={`flex w-full items-stretch border-b text-sm last:border-0 ${
                          active ? "bg-muted" : ""
                        }`}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-auto shrink-0 rounded-none"
                          aria-label={fav ? "Remove favorite" : "Add favorite"}
                          onClick={() => toggleFavorite(s.NORAD_CAT_ID)}
                        >
                          <Star
                            className={`h-4 w-4 ${fav ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                          />
                        </Button>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left hover:bg-muted/60"
                          onClick={() => setSelectedNorad(s.NORAD_CAT_ID)}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {s.OBJECT_NAME}
                          </span>
                          <Badge variant="secondary">{s.NORAD_CAT_ID}</Badge>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="min-w-0">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="min-w-0 flex-1 space-y-1.5">
                <CardTitle>Pass prediction</CardTitle>
                <CardDescription>
                  SGP4 propagation in-browser (30s steps). Tune horizon and minimum elevation.
                </CardDescription>
              </div>
              {exportMeta && passes.length > 0 ? (
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
                          downloadPassesCsv(passes, exportMeta);
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
                          await downloadPassesXlsx(passes, exportMeta);
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
                          await downloadPassesPdf(passes, exportMeta);
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
            <CardContent className="min-w-0 space-y-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minEl">Minimum elevation (°)</Label>
                  <Input
                    id="minEl"
                    type="number"
                    min={0}
                    max={90}
                    value={minEl}
                    onChange={(e) =>
                      setMinEl(Number.parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="days">Horizon (days)</Label>
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={14}
                    value={horizonDays}
                    onChange={(e) =>
                      setHorizonDays(Number.parseInt(e.target.value, 10) || 7)
                    }
                  />
                </div>
              </div>
              {!selectedRecord ? (
                <p className="text-sm text-muted-foreground">
                  Select a satellite from the list.
                </p>
              ) : passes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No passes above {minEl}° in the next {horizonDays} days for{" "}
                  <span className="font-medium">{selectedRecord.OBJECT_NAME}</span>.
                  Missing TLE lines — try another group or refresh upstream cache.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                    {passes.map((p, idx) => (
                      <TableRow
                        key={`${p.noradId}-${p.aos.toISOString()}-${idx}`}
                        data-state={activePassIdx === idx ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => {
                          setActivePassIdx(idx);
                          setDetailPass(p);
                        }}
                      >
                        <TableCell className="whitespace-nowrap">
                          {formatTime(p.aos)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatTime(p.tca)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatTime(p.los)}
                        </TableCell>
                        <TableCell>{p.maxElDeg.toFixed(1)}°</TableCell>
                        <TableCell>{p.azTcaDeg.toFixed(0)}°</TableCell>
                        <TableCell>{formatDur(p.durationSec)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.observerSkyHint}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {displayPass ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sky plot</CardTitle>
                  <CardDescription>
                    Azimuth / elevation path (north up, zenith center).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SkyPlot track={displayPass.track} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ground track</CardTitle>
                  <CardDescription>
                    Observer (red) and subsatellite path for the selected pass.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GroundTrackMap
                    observerLat={observer.latDeg}
                    observerLon={observer.lonDeg}
                    track={displayPass.track}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>

      {detailPass && selectedRecord ? (
        <PassDetailDialog
          open
          onOpenChange={(next) => {
            if (!next) setDetailPass(null);
          }}
          pass={detailPass}
          record={selectedRecord}
          observer={observerModel}
          groupId={groupId}
        />
      ) : null}
    </AppShell>
  );
}
