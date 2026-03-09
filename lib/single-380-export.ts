import * as XLSX from "xlsx";
import { type Single380Row } from "@/lib/single-380-parser";

export interface Single380SheetSelection {
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

export function downloadSingle380MultiSheetXlsx(
  groupedByWell: Record<string, Single380Row[]>,
  sourceFileNames: string[],
  sheets: Single380SheetSelection[]
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

      return {
        sheetName: sanitizeSheetName(sheet.sheetName, `Sheet ${idx + 1}`),
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
      aoa.push(["sourceFileName", "timepointIndex", "t380", "f380"]);

      const wellRows = [...groupedByWell[well.wellId]].sort((a, b) => {
        if (a.sourceFileName !== b.sourceFileName) {
          return a.sourceFileName.localeCompare(b.sourceFileName);
        }
        return a.timepointIndex - b.timepointIndex;
      });

      for (const row of wellRows) {
        aoa.push([row.sourceFileName, row.timepointIndex, row.t380, row.f380]);
      }

      aoa.push([]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, sheet, getUniqueSheetName(sheetConfig.sheetName, `Sheet ${idx + 1}`, usedSheetNames));
  }

  const fileName = `${getExportBaseName(sourceFileNames)}-single380-multi-sheet.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}
