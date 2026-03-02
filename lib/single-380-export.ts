import * as XLSX from "xlsx";
import { type Single380Row } from "@/lib/single-380-parser";

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "single-380-output";
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

function getExportBaseName(sourceFileNames: string[]): string {
  if (sourceFileNames.length === 1) {
    return sanitizeFileName(stripExtension(sourceFileNames[0]));
  }
  return "single-380-merged";
}

export function downloadSingle380PerWellXlsx(
  groupedByWell: Record<string, Single380Row[]>,
  sourceFileNames: string[],
  selectedWellIds?: string[]
) {
  const workbook = XLSX.utils.book_new();
  const allWellIds = Object.keys(groupedByWell).sort(compareWellIds);
  const requestedWellIds = selectedWellIds?.length ? selectedWellIds : allWellIds;
  const wellIds = requestedWellIds.filter((wellId) => groupedByWell[wellId]).sort(compareWellIds);

  const summaryRows = wellIds.map((wellId) => {
    const wellRows = groupedByWell[wellId];
    const latest = [...wellRows].sort((a, b) => b.timepointIndex - a.timepointIndex)[0];
    const filesCount = new Set(wellRows.map((row) => row.sourceFileName)).size;
    return {
      wellId,
      timepoints: wellRows.length,
      filesCount,
      latestF380: latest?.f380 ?? null
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: ["wellId", "timepoints", "filesCount", "latestF380"]
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, "wells_summary");

  for (const wellId of wellIds) {
    const wellRows = [...groupedByWell[wellId]].sort((a, b) => {
      if (a.sourceFileName !== b.sourceFileName) {
        return a.sourceFileName.localeCompare(b.sourceFileName);
      }
      return a.timepointIndex - b.timepointIndex;
    });

    const sheetRows = wellRows.map((row) => ({
      sourceFileName: row.sourceFileName,
      timepointIndex: row.timepointIndex,
      t380: row.t380,
      f380: row.f380
    }));

    const sheet = XLSX.utils.json_to_sheet(sheetRows, {
      header: ["sourceFileName", "timepointIndex", "t380", "f380"]
    });
    XLSX.utils.book_append_sheet(workbook, sheet, wellId);
  }

  const suffix = selectedWellIds?.length ? "single380-selected-wells" : "single380-by-well";
  const fileName = `${getExportBaseName(sourceFileNames)}-${suffix}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}

