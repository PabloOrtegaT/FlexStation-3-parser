import * as XLSX from "xlsx";
import { type GroupedByWell } from "@/lib/plate-reader-parser";

export interface WellSheetSelection {
  sheetName: string;
  wells: Array<{
    wellId: string;
    label: string;
  }>;
}

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

function sanitizeSheetName(rawName: string, fallback: string): string {
  const trimmed = rawName.trim().replace(/[\[\]\*\/\\\?\:]+/g, " ");
  const normalized = trimmed.replace(/\s+/g, " ").trim();
  const safe = normalized || fallback;
  return safe.slice(0, 31);
}

function getUniqueSheetName(rawName: string, fallback: string, used: Set<string>): string {
  const base = sanitizeSheetName(rawName, fallback);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const suffixText = ` (${suffix})`;
    const maxBaseLength = 31 - suffixText.length;
    const candidate = `${base.slice(0, maxBaseLength)}${suffixText}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    suffix += 1;
  }

  const fallbackCandidate = sanitizeSheetName(fallback, "Sheet").slice(0, 31);
  used.add(fallbackCandidate);
  return fallbackCandidate;
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

export function downloadMultiSheetWellOutputXlsx(
  groupedByWell: GroupedByWell,
  sourceFileName: string | null,
  sheets: WellSheetSelection[]
) {
  const workbook = XLSX.utils.book_new();
  const usedSheetNames = new Set<string>();

  const normalizedSheets = sheets
    .map((sheet, idx) => {
      const byWellId = new Map<string, { wellId: string; label: string }>();

      for (const well of sheet.wells) {
        if (!groupedByWell[well.wellId]) {
          continue;
        }
        if (!byWellId.has(well.wellId)) {
          byWellId.set(well.wellId, {
            wellId: well.wellId,
            label: well.label.trim() || well.wellId
          });
        }
      }

      const validWells = [...byWellId.values()].sort((a, b) => compareWellIds(a.wellId, b.wellId));
      if (validWells.length === 0) {
        return null;
      }

      const sheetName = sanitizeSheetName(sheet.sheetName, `Tab ${idx + 1}`);
      return {
        sheetName,
        wells: validWells
      };
    })
    .filter((sheet): sheet is { sheetName: string; wells: Array<{ wellId: string; label: string }> } => Boolean(sheet));

  if (normalizedSheets.length === 0) {
    return;
  }

  const summaryRows = normalizedSheets.map((sheet) => ({
    sheetName: sheet.sheetName,
    wells: sheet.wells.map((well) => (well.label === well.wellId ? well.wellId : `${well.label} (${well.wellId})`)).join(", "),
    wellCount: sheet.wells.length
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    header: ["sheetName", "wells", "wellCount"]
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, getUniqueSheetName("sheet_index", "sheet_index", usedSheetNames));

  for (const [idx, sheetConfig] of normalizedSheets.entries()) {
    const aoa: Array<Array<string | number | null>> = [];
    aoa.push([
      "Wells in this sheet",
      sheetConfig.wells.map((well) => (well.label === well.wellId ? well.wellId : `${well.label} (${well.wellId})`)).join(", ")
    ]);
    aoa.push([]);

    for (const well of sheetConfig.wells) {
      aoa.push([well.label === well.wellId ? `Well ${well.wellId}` : `Well ${well.wellId} - ${well.label}`]);
      aoa.push(["timepointIndex", "t340", "f340", "t380", "f380", "ratio"]);

      for (const point of groupedByWell[well.wellId]) {
        aoa.push([point.timepointIndex, point.t340, point.f340, point.t380, point.f380, point.ratio]);
      }

      aoa.push([]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, sheet, getUniqueSheetName(sheetConfig.sheetName, `Tab ${idx + 1}`, usedSheetNames));
  }

  const fileName = `${getExportBaseName(sourceFileName)}-normalized-multi-sheet.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}
