import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { groupByWell, parsePlateReaderWorkbook } from "../lib/plate-reader-parser";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function createMinimalWorkbookArrayBuffer(): ArrayBuffer {
  const header = new Array(49).fill(null);
  for (let i = 0; i < 24; i += 1) {
    header[i] = i + 1;
    header[25 + i] = i + 1;
  }

  const tsRow = new Array(49).fill(null);
  const valRow = new Array(49).fill(null);
  tsRow[0] = 1.1;
  tsRow[25] = 2.2;
  valRow[0] = 10;
  valRow[25] = 0;

  const ws = XLSX.utils.aoa_to_sheet([header, tsRow, valRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

describe("parsePlateReaderWorkbook", () => {
  it("detects layout and validates A3 first 3 timepoints for provided sample", () => {
    const samplePath = resolve(process.cwd(), "4_5850732217298329244.xlsx");
    const sampleBytes = readFileSync(samplePath);
    const parsed = parsePlateReaderWorkbook(toArrayBuffer(sampleBytes));

    expect(parsed.meta.headerRow1Based).toBe(3);
    expect(parsed.meta.colStart340Label).toBe("C");
    expect(parsed.meta.colStart380Label).toBe("AB");
    expect(parsed.meta.firstCycleStartRow1Based).toBe(4);
    expect(parsed.meta.cycleStride).toBe(33);

    const a3 = parsed.rows.filter((row) => row.wellId === "A3").slice(0, 3);
    expect(a3).toHaveLength(3);

    expect(a3[0].t340).toBeCloseTo(0.8622, 10);
    expect(a3[0].f340).toBeCloseTo(206.734, 10);
    expect(a3[0].t380).toBeCloseTo(3.6398, 10);
    expect(a3[0].f380).toBeCloseTo(143.308, 10);
    expect(a3[0].ratio).toBeCloseTo(1.4425852011, 10);

    expect(a3[1].t340).toBeCloseTo(5.523, 10);
    expect(a3[1].f340).toBeCloseTo(200.982, 10);
    expect(a3[1].t380).toBeCloseTo(8.2894, 10);
    expect(a3[1].f380).toBeCloseTo(142.975, 10);
    expect(a3[1].ratio).toBeCloseTo(1.4057142857, 10);

    expect(a3[2].t340).toBeCloseTo(9.931, 10);
    expect(a3[2].f340).toBeCloseTo(205.483, 10);
    expect(a3[2].t380).toBeCloseTo(12.699, 10);
    expect(a3[2].f380).toBeCloseTo(138.595, 10);
    expect(a3[2].ratio).toBeCloseTo(1.4826148129, 10);
  });

  it("returns null ratio when denominator is zero and skips empty wells", () => {
    const parsed = parsePlateReaderWorkbook(createMinimalWorkbookArrayBuffer());
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].wellId).toBe("A1");
    expect(parsed.rows[0].ratio).toBeNull();
  });

  it("groups parsed records by well", () => {
    const samplePath = resolve(process.cwd(), "4_5850732217298329244.xlsx");
    const sampleBytes = readFileSync(samplePath);
    const parsed = parsePlateReaderWorkbook(toArrayBuffer(sampleBytes));
    const grouped = groupByWell(parsed.rows);

    expect(grouped.A3).toBeDefined();
    expect(grouped.A3.length).toBeGreaterThanOrEqual(3);
    expect(grouped.A3[0].timepointIndex).toBe(0);
  });
});
