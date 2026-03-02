import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSingle380Workbook } from "../lib/single-380-parser";

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("parseSingle380Workbook", () => {
  it("parses MEDIUM file with expected layout and A3 values", () => {
    const samplePath = resolve(process.cwd(), "20260227_Fura2uM_stim_380_MEDIUM_cloud convert.xlsx");
    const sampleBytes = readFileSync(samplePath);
    const parsed = parseSingle380Workbook(toArrayBuffer(sampleBytes));

    expect(parsed.meta.headerRow1Based).toBe(3);
    expect(parsed.meta.colStart380Label).toBe("C");
    expect(parsed.meta.firstCycleStartRow1Based).toBe(4);
    expect(parsed.meta.cycleStride).toBe(33);

    const a3 = parsed.rows.filter((row) => row.wellId === "A3").slice(0, 3);
    expect(a3).toHaveLength(3);

    expect(a3[0].t380).toBeCloseTo(0.75, 10);
    expect(a3[0].f380).toBeCloseTo(123.912, 10);
    expect(a3[1].t380).toBeCloseTo(1.8364, 10);
    expect(a3[1].f380).toBeCloseTo(125.274, 10);
    expect(a3[2].t380).toBeCloseTo(3.0332, 10);
    expect(a3[2].f380).toBeCloseTo(124.426, 10);
  });

  it("parses HIGH file where data starts later and keeps same stride", () => {
    const samplePath = resolve(process.cwd(), "20260227_Fura2uM_stim_380_HIGH_cloud convert.xlsx");
    const sampleBytes = readFileSync(samplePath);
    const parsed = parseSingle380Workbook(toArrayBuffer(sampleBytes));

    expect(parsed.meta.headerRow1Based).toBe(3);
    expect(parsed.meta.colStart380Label).toBe("C");
    expect(parsed.meta.firstCycleStartRow1Based).toBe(20);
    expect(parsed.meta.cycleStride).toBe(33);

    const a3 = parsed.rows.filter((row) => row.wellId === "A3").slice(0, 3);
    expect(a3).toHaveLength(3);

    expect(a3[0].t380).toBeCloseTo(0.7108, 10);
    expect(a3[0].f380).toBeCloseTo(94.324, 10);
    expect(a3[1].t380).toBeCloseTo(1.7972, 10);
    expect(a3[1].f380).toBeCloseTo(92.485, 10);
    expect(a3[2].t380).toBeCloseTo(2.9956, 10);
    expect(a3[2].f380).toBeCloseTo(90.091, 10);
  });
});

