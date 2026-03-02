import * as XLSX from "xlsx";

export type Num = number | null;

export interface WellTimepointRow {
  wellId: string;
  plateRow: string;
  plateCol: number;
  timepointIndex: number;
  t340: Num;
  f340: Num;
  t380: Num;
  f380: Num;
  ratio: Num;
}

export interface ParseOptions {
  sheetName?: string;
  plateRows?: number;
  plateCols?: number;
}

export interface ParseMeta {
  sheetName: string;
  headerRow1Based: number;
  colStart3401Based: number;
  colStart340Label: string;
  colStart3801Based: number;
  colStart380Label: string;
  firstCycleStartRow1Based: number;
  cycleStride: number;
}

export interface ParseOutput {
  meta: ParseMeta;
  rows: WellTimepointRow[];
}

export interface WellSeriesPoint {
  timepointIndex: number;
  t340: Num;
  f340: Num;
  t380: Num;
  f380: Num;
  ratio: Num;
}

export type GroupedByWell = Record<string, WellSeriesPoint[]>;

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[address]?.v;
}

function isEmptyCell(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isHeaderSequenceStart(sheet: XLSX.WorkSheet, row: number, colStart: number, plateCols: number): boolean {
  for (let i = 0; i < plateCols; i += 1) {
    const n = toNumberOrNull(getCellValue(sheet, row, colStart + i));
    if (n !== i + 1) {
      return false;
    }
  }
  return true;
}

function hasAnyNumericInBlock(sheet: XLSX.WorkSheet, row: number, colStart: number, plateCols: number): boolean {
  for (let i = 0; i < plateCols; i += 1) {
    if (toNumberOrNull(getCellValue(sheet, row, colStart + i)) !== null) {
      return true;
    }
  }
  return false;
}

function isBlankAcrossBlocks(
  sheet: XLSX.WorkSheet,
  row: number,
  colStart340: number,
  colStart380: number,
  plateCols: number
): boolean {
  for (let i = 0; i < plateCols; i += 1) {
    if (!isEmptyCell(getCellValue(sheet, row, colStart340 + i))) {
      return false;
    }
    if (!isEmptyCell(getCellValue(sheet, row, colStart380 + i))) {
      return false;
    }
  }
  return true;
}

function colIndexToLabel(index0Based: number): string {
  let n = index0Based + 1;
  let out = "";

  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }

  return out;
}

export function parsePlateReaderWorkbook(input: ArrayBuffer, options: ParseOptions = {}): ParseOutput {
  const plateRows = options.plateRows ?? 16;
  const plateCols = options.plateCols ?? 24;

  const workbook = XLSX.read(input, {
    type: "array",
    raw: true,
    cellDates: false
  });

  const sheetName = options.sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  if (!sheet["!ref"]) {
    throw new Error(`Sheet "${sheetName}" has no data range`);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"]);

  let headerRow = -1;
  let colStart340 = -1;
  let colStart380 = -1;

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const starts: number[] = [];
    for (let c = range.s.c; c <= range.e.c - (plateCols - 1); c += 1) {
      if (isHeaderSequenceStart(sheet, r, c, plateCols)) {
        starts.push(c);
      }
    }

    if (starts.length >= 2) {
      headerRow = r;
      colStart340 = starts[0];
      colStart380 = starts[1];
      break;
    }
  }

  if (headerRow < 0 || colStart340 < 0 || colStart380 < 0) {
    throw new Error("Could not find a header row containing two 1..24 blocks.");
  }

  if (colStart380 <= colStart340 + (plateCols - 1)) {
    throw new Error("Detected 340nm and 380nm blocks overlap or are invalid.");
  }

  let firstCycleStart = -1;
  for (let r = headerRow + 1; r <= range.e.r; r += 1) {
    if (hasAnyNumericInBlock(sheet, r, colStart340, plateCols) || hasAnyNumericInBlock(sheet, r, colStart380, plateCols)) {
      firstCycleStart = r;
      break;
    }
  }

  if (firstCycleStart < 0) {
    throw new Error("Could not find first cycle start row after header.");
  }

  const reservedCycleRows = plateRows * 2;
  let cycleStride: number | null = null;

  for (let r = firstCycleStart + reservedCycleRows; r <= range.e.r + 1; r += 1) {
    if (isBlankAcrossBlocks(sheet, r, colStart340, colStart380, plateCols)) {
      cycleStride = r - firstCycleStart + 1;
      break;
    }
  }

  if (cycleStride === null) {
    for (let r = firstCycleStart + reservedCycleRows; r <= range.e.r; r += 1) {
      if (hasAnyNumericInBlock(sheet, r, colStart340, plateCols) || hasAnyNumericInBlock(sheet, r, colStart380, plateCols)) {
        cycleStride = r - firstCycleStart;
        break;
      }
    }
  }

  if (cycleStride === null || cycleStride <= 0) {
    cycleStride = reservedCycleRows;
  }

  const rows: WellTimepointRow[] = [];

  for (let cycleIndex = 0; ; cycleIndex += 1) {
    const cycleStart = firstCycleStart + cycleIndex * cycleStride;
    if (cycleStart > range.e.r + reservedCycleRows) {
      break;
    }

    let cycleHasData = false;

    for (let plateRowIndex = 0; plateRowIndex < plateRows; plateRowIndex += 1) {
      const tsRow = cycleStart + plateRowIndex * 2;
      const valRow = tsRow + 1;
      const plateRow = String.fromCharCode(65 + plateRowIndex);

      for (let plateCol = 1; plateCol <= plateCols; plateCol += 1) {
        const c340 = colStart340 + (plateCol - 1);
        const c380 = colStart380 + (plateCol - 1);

        const t340 = toNumberOrNull(getCellValue(sheet, tsRow, c340));
        const f340 = toNumberOrNull(getCellValue(sheet, valRow, c340));
        const t380 = toNumberOrNull(getCellValue(sheet, tsRow, c380));
        const f380 = toNumberOrNull(getCellValue(sheet, valRow, c380));

        if (t340 === null && f340 === null && t380 === null && f380 === null) {
          continue;
        }

        cycleHasData = true;
        rows.push({
          wellId: `${plateRow}${plateCol}`,
          plateRow,
          plateCol,
          timepointIndex: cycleIndex,
          t340,
          f340,
          t380,
          f380,
          ratio: f340 !== null && f380 !== null && f380 !== 0 ? f340 / f380 : null
        });
      }
    }

    if (!cycleHasData) {
      break;
    }
  }

  return {
    meta: {
      sheetName,
      headerRow1Based: headerRow + 1,
      colStart3401Based: colStart340 + 1,
      colStart340Label: colIndexToLabel(colStart340),
      colStart3801Based: colStart380 + 1,
      colStart380Label: colIndexToLabel(colStart380),
      firstCycleStartRow1Based: firstCycleStart + 1,
      cycleStride
    },
    rows
  };
}

export function groupByWell(rows: WellTimepointRow[]): GroupedByWell {
  const grouped: GroupedByWell = {};

  for (const row of rows) {
    if (!grouped[row.wellId]) {
      grouped[row.wellId] = [];
    }
    grouped[row.wellId].push({
      timepointIndex: row.timepointIndex,
      t340: row.t340,
      f340: row.f340,
      t380: row.t380,
      f380: row.f380,
      ratio: row.ratio
    });
  }

  for (const series of Object.values(grouped)) {
    series.sort((a, b) => a.timepointIndex - b.timepointIndex);
  }

  return grouped;
}

