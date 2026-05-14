import type { PassEvent } from "./passes";

/** Metadata included in exports (observer + run settings). */
export type PassExportMeta = {
  satelliteName: string;
  noradId: number;
  observerLat: number;
  observerLon: number;
  observerAltKm: number;
  minElDeg: number;
  horizonDays: number;
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function exportFilenameBase(meta: PassExportMeta): string {
  const safe = meta.satelliteName
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 48);
  const d = new Date().toISOString().slice(0, 10);
  return `passes_${meta.noradId}_${safe}_${d}`;
}

function rowsForSheet(
  passes: PassEvent[],
  meta: PassExportMeta
): Record<string, string | number>[] {
  return passes.map((p) => ({
    NORAD: meta.noradId,
    Satellite: meta.satelliteName,
    AOS_UTC: p.aos.toISOString(),
    TCA_UTC: p.tca.toISOString(),
    LOS_UTC: p.los.toISOString(),
    MaxElevation_deg: Number(p.maxElDeg.toFixed(2)),
    AzimuthAtTCA_deg: Number(p.azTcaDeg.toFixed(1)),
    Duration: formatDuration(p.durationSec),
    Duration_seconds: Math.round(p.durationSec),
    ObserverSky: p.observerSkyHint,
  }));
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPassesCsv(
  passes: PassEvent[],
  meta: PassExportMeta
): void {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const rows = rowsForSheet(passes, meta);
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => escapeCsvCell(String(row[h] ?? "")))
        .join(",")
    ),
  ];
  const csv = `\uFEFF${lines.join("\r\n")}`;
  triggerDownloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${exportFilenameBase(meta)}.csv`
  );
}

export async function downloadPassesXlsx(
  passes: PassEvent[],
  meta: PassExportMeta
): Promise<void> {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const XLSX = await import("xlsx");
  const rows = rowsForSheet(passes, meta);
  const metaSheet = [
    { Field: "Satellite", Value: `${meta.satelliteName} (${meta.noradId})` },
    { Field: "Observer_lat_deg", Value: meta.observerLat },
    { Field: "Observer_lon_deg", Value: meta.observerLon },
    { Field: "Observer_alt_km", Value: meta.observerAltKm },
    { Field: "Min_elevation_deg", Value: meta.minElDeg },
    { Field: "Horizon_days", Value: meta.horizonDays },
    { Field: "Exported_UTC", Value: new Date().toISOString() },
  ];
  const wb = XLSX.utils.book_new();
  const wsPasses = XLSX.utils.json_to_sheet(rows);
  const wsMeta = XLSX.utils.json_to_sheet(metaSheet);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Run info");
  XLSX.utils.book_append_sheet(wb, wsPasses, "Passes");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${exportFilenameBase(meta)}.xlsx`
  );
}

export async function downloadPassesPdf(
  passes: PassEvent[],
  meta: PassExportMeta
): Promise<void> {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(
    `Pass predictions: ${meta.satelliteName} (NORAD ${meta.noradId})`,
    14,
    12
  );
  doc.setFontSize(9);
  let y = 19;
  for (const line of [
    `Observer: ${meta.observerLat.toFixed(5)} deg lat, ${meta.observerLon.toFixed(5)} deg lon, ${meta.observerAltKm} km alt`,
    `Min elevation: ${meta.minElDeg} deg  |  Horizon: ${meta.horizonDays} days  |  Generated (UTC): ${new Date().toISOString()}`,
  ]) {
    doc.text(line, 14, y);
    y += 5;
  }

  const head = [
    [
      "AOS (UTC)",
      "TCA (UTC)",
      "LOS (UTC)",
      "Max el (deg)",
      "Az @ TCA (deg)",
      "Duration",
      "Observer sky",
    ],
  ];
  const body = passes.map((p) => [
    p.aos.toISOString().replace("T", " ").slice(0, 19),
    p.tca.toISOString().replace("T", " ").slice(0, 19),
    p.los.toISOString().replace("T", " ").slice(0, 19),
    p.maxElDeg.toFixed(1),
    p.azTcaDeg.toFixed(0),
    formatDuration(p.durationSec),
    p.observerSkyHint,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60] },
    theme: "striped",
    margin: { left: 14, right: 14 },
  });

  doc.save(`${exportFilenameBase(meta)}.pdf`);
}

/** Metadata for multi-satellite batch exports. */
export type BatchPassExportMeta = {
  observerLat: number;
  observerLon: number;
  observerAltKm: number;
  minElDeg: number;
  windowStartUtc: string;
  windowEndUtc: string;
  groupId: string;
  /** Human-readable group name when available */
  groupLabel?: string;
  /** Number of satellites included in the batch run */
  selectedSatelliteCount: number;
};

function batchExportFilenameBase(meta: BatchPassExportMeta): string {
  const d = new Date().toISOString().slice(0, 10);
  const safeG = meta.groupId.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 40);
  return `batch_passes_${safeG}_${d}`;
}

function batchRowsForSheet(
  passes: PassEvent[]
): Record<string, string | number>[] {
  return passes.map((p) => ({
    NORAD: p.noradId,
    Satellite: p.name,
    AOS_UTC: p.aos.toISOString(),
    TCA_UTC: p.tca.toISOString(),
    LOS_UTC: p.los.toISOString(),
    MaxElevation_deg: Number(p.maxElDeg.toFixed(2)),
    AzimuthAtTCA_deg: Number(p.azTcaDeg.toFixed(1)),
    Duration: formatDuration(p.durationSec),
    Duration_seconds: Math.round(p.durationSec),
    ObserverSky: p.observerSkyHint,
  }));
}

export function downloadBatchPassesCsv(
  passes: PassEvent[],
  meta: BatchPassExportMeta
): void {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const rows = batchRowsForSheet(passes);
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => escapeCsvCell(String(row[h] ?? "")))
        .join(",")
    ),
  ];
  const csv = `\uFEFF${lines.join("\r\n")}`;
  triggerDownloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${batchExportFilenameBase(meta)}.csv`
  );
}

export async function downloadBatchPassesXlsx(
  passes: PassEvent[],
  meta: BatchPassExportMeta
): Promise<void> {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const XLSX = await import("xlsx");
  const rows = batchRowsForSheet(passes);
  const metaSheet = [
    { Field: "Report", Value: "Batch pass predictions" },
    { Field: "TLE_group", Value: meta.groupLabel ?? meta.groupId },
    { Field: "Group_id", Value: meta.groupId },
    {
      Field: "Window_start_UTC",
      Value: meta.windowStartUtc,
    },
    { Field: "Window_end_UTC", Value: meta.windowEndUtc },
    { Field: "Satellites_in_batch", Value: meta.selectedSatelliteCount },
    { Field: "Pass_rows", Value: passes.length },
    { Field: "Observer_lat_deg", Value: meta.observerLat },
    { Field: "Observer_lon_deg", Value: meta.observerLon },
    { Field: "Observer_alt_km", Value: meta.observerAltKm },
    { Field: "Min_elevation_deg", Value: meta.minElDeg },
    { Field: "Exported_UTC", Value: new Date().toISOString() },
  ];
  const wb = XLSX.utils.book_new();
  const wsPasses = XLSX.utils.json_to_sheet(rows);
  const wsMeta = XLSX.utils.json_to_sheet(metaSheet);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Run info");
  XLSX.utils.book_append_sheet(wb, wsPasses, "Passes");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${batchExportFilenameBase(meta)}.xlsx`
  );
}

export async function downloadBatchPassesPdf(
  passes: PassEvent[],
  meta: BatchPassExportMeta
): Promise<void> {
  if (passes.length === 0) {
    throw new Error("No passes to export");
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text("Batch pass predictions", 14, 12);
  doc.setFontSize(9);
  let y = 19;
  for (const line of [
    `Group: ${meta.groupLabel ?? meta.groupId} (${meta.groupId})`,
    `Window (UTC): ${meta.windowStartUtc.replace("T", " ").slice(0, 19)} → ${meta.windowEndUtc.replace("T", " ").slice(0, 19)}`,
    `Satellites in batch: ${meta.selectedSatelliteCount}  |  Passes: ${passes.length}  |  Min elevation: ${meta.minElDeg} deg`,
    `Observer: ${meta.observerLat.toFixed(5)} deg lat, ${meta.observerLon.toFixed(5)} deg lon, ${meta.observerAltKm} km alt`,
    `Generated (UTC): ${new Date().toISOString()}`,
  ]) {
    doc.text(line, 14, y);
    y += 5;
  }

  const head = [
    [
      "Satellite",
      "NORAD",
      "AOS (UTC)",
      "TCA (UTC)",
      "LOS (UTC)",
      "Max el (deg)",
      "Az @ TCA (deg)",
      "Duration",
      "Observer sky",
    ],
  ];
  const body = passes.map((p) => [
    p.name.slice(0, 42),
    String(p.noradId),
    p.aos.toISOString().replace("T", " ").slice(0, 19),
    p.tca.toISOString().replace("T", " ").slice(0, 19),
    p.los.toISOString().replace("T", " ").slice(0, 19),
    p.maxElDeg.toFixed(1),
    p.azTcaDeg.toFixed(0),
    formatDuration(p.durationSec),
    p.observerSkyHint,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [60, 60, 60] },
    theme: "striped",
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 18 },
    },
  });

  doc.save(`${batchExportFilenameBase(meta)}.pdf`);
}
