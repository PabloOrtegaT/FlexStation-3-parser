import * as XLSX from "xlsx";

export type Num = number | null;

export interface Single380Row {
  sourceFileName: string;
  wellId: string;
  plateRow: string;
  plateCol: number;
  timepointIndex: number;
  t380: Num;
  f380: Num;
}

export interface Single380ParseMeta {
  sheetName: string;
  headerRow1Based: number;
  colStart3801Based: number;
  colStart380Label: string;
  firstCycleStartRow1Based: number;
  cycleStride: number;
}

export interface Single380ParseOutput {
  meta: Single380ParseMeta;
  rows: Omit<Single380Row, "sourceFileName">[];
}

export interface Single380ParseOptions {
  sheetName?: string;
  plateRows?: number;
  plateCols?: number;
}

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

function isBlankAcrossBlock(sheet: XLSX.WorkSheet, row: number, colStart: number, plateCols: number): boolean {
  for (let i = 0; i < plateCols; i += 1) {
    if (!isEmptyCell(getCellValue(sheet, row, colStart + i))) {
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

export function parseSingle380Workbook(input: ArrayBuffer, options: Single380ParseOptions = {}): Single380ParseOutput {
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
  let colStart380 = -1;

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c - (plateCols - 1); c += 1) {
      if (isHeaderSequenceStart(sheet, r, c, plateCols)) {
        headerRow = r;
        colStart380 = c;
        break;
      }
    }
    if (headerRow >= 0) {
      break;
    }
  }

  if (headerRow < 0 || colStart380 < 0) {
    throw new Error("Could not find a header row containing a 1..24 block.");
  }

  let firstCycleStart = -1;
  for (let r = headerRow + 1; r <= range.e.r; r += 1) {
    if (hasAnyNumericInBlock(sheet, r, colStart380, plateCols)) {
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
    if (isBlankAcrossBlock(sheet, r, colStart380, plateCols)) {
      cycleStride = r - firstCycleStart + 1;
      break;
    }
  }

  if (cycleStride === null) {
    for (let r = firstCycleStart + reservedCycleRows; r <= range.e.r; r += 1) {
      if (hasAnyNumericInBlock(sheet, r, colStart380, plateCols)) {
        cycleStride = r - firstCycleStart;
        break;
      }
    }
  }

  if (cycleStride === null || cycleStride <= 0) {
    cycleStride = reservedCycleRows;
  }

  const rows: Omit<Single380Row, "sourceFileName">[] = [];

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
        const c380 = colStart380 + (plateCol - 1);

        const t380 = toNumberOrNull(getCellValue(sheet, tsRow, c380));
        const f380 = toNumberOrNull(getCellValue(sheet, valRow, c380));

        if (t380 === null && f380 === null) {
          continue;
        }

        cycleHasData = true;
        rows.push({
          wellId: `${plateRow}${plateCol}`,
          plateRow,
          plateCol,
          timepointIndex: cycleIndex,
          t380,
          f380
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
      colStart3801Based: colStart380 + 1,
      colStart380Label: colIndexToLabel(colStart380),
      firstCycleStartRow1Based: firstCycleStart + 1,
      cycleStride
    },
    rows
  };
}

