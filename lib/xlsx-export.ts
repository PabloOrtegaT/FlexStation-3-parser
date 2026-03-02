import * as XLSX from "xlsx";
import { type GroupedByWell } from "@/lib/plate-reader-parser";

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "plate-reader";
}

function parseWellId(wellId: string): { row: number; col: number } {
  const match = /^([A-Z])(\d+)$/.exec(wellId);
  if (!match) {
    return { row: Number.MAX_SAFE_INTEGER, col: Number.MAX_SAFE_INTEGER };
  }

  return {
    row: match[1].charCodeAt(0) - 65,
    col: Number(match[2])
  };
}

function compareWellIds(a: string, b: string): number {
  const pa = parseWellId(a);
  const pb = parseWellId(b);
  if (pa.row !== pb.row) {
    return pa.row - pb.row;
  }
  return pa.col - pb.col;
}

function getExportBaseName(sourceFileName: string | null): string {
  if (!sourceFileName) {
    return "plate-reader-output";
  }
  return sanitizeFileName(stripExtension(sourceFileName));
}

export function downloadPerWellOutputXlsx(
  groupedByWell: GroupedByWell,
  sourceFileName: string | null,
  selectedWellIds?: string[]
) {
  const workbook = XLSX.utils.book_new();
  const allWellIds = Object.keys(groupedByWell).sort(compareWellIds);
  const requestedWellIds = selectedWellIds?.length ? selectedWellIds : allWellIds;
  const wellIds = requestedWellIds.filter((wellId) => groupedByWell[wellId]).sort(compareWellIds);

  const summaryRows = wellIds.map((wellId) => {
    const series = groupedByWell[wellId];
    const latest = series[series.length - 1];
    return {
      wellId,
      timepoints: series.length,
      latestRatio: latest?.ratio ?? null
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: ["wellId", "timepoints", "latestRatio"]
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, "wells_summary");

  for (const wellId of wellIds) {
    const seriesRows = groupedByWell[wellId].map((point) => ({
      timepointIndex: point.timepointIndex,
      t340: point.t340,
      f340: point.f340,
      t380: point.t380,
      f380: point.f380,
      ratio: point.ratio
    }));

    const wellSheet = XLSX.utils.json_to_sheet(seriesRows, {
      header: ["timepointIndex", "t340", "f340", "t380", "f380", "ratio"]
    });

    XLSX.utils.book_append_sheet(workbook, wellSheet, wellId);
  }

  const fileSuffix = selectedWellIds?.length ? "normalized-selected-wells" : "normalized-by-well";
  const fileName = `${getExportBaseName(sourceFileName)}-${fileSuffix}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}
