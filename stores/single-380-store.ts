"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseSingle380Workbook, type Single380ParseMeta, type Single380Row } from "@/lib/single-380-parser";

export type Single380AnalysisStatus = "idle" | "reading" | "parsing" | "normalizing" | "ready" | "error";

export interface ParsedSingle380File {
  sourceFileName: string;
  meta: Single380ParseMeta;
  rows: Single380Row[];
}

export interface Single380State {
  status: Single380AnalysisStatus;
  error: string | null;
  files: ParsedSingle380File[];
  rows: Single380Row[];
  groupedByWell: Record<string, Single380Row[]>;
  uploadedAt: string | null;
  analyzeFiles: (files: File[]) => Promise<void>;
  clearData: () => void;
}

const pauseForUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function groupRowsByWell(rows: Single380Row[]): Record<string, Single380Row[]> {
  const grouped: Record<string, Single380Row[]> = {};
  for (const row of rows) {
    if (!grouped[row.wellId]) {
      grouped[row.wellId] = [];
    }
    grouped[row.wellId].push(row);
  }
  for (const wellRows of Object.values(grouped)) {
    wellRows.sort((a, b) => {
      if (a.sourceFileName !== b.sourceFileName) {
        return a.sourceFileName.localeCompare(b.sourceFileName);
      }
      return a.timepointIndex - b.timepointIndex;
    });
  }
  return grouped;
}

export const useSingle380Store = create<Single380State>()(
  persist(
    (set) => ({
      status: "idle",
      error: null,
      files: [],
      rows: [],
      groupedByWell: {},
      uploadedAt: null,
      analyzeFiles: async (files) => {
        if (files.length === 0) {
          set({ status: "error", error: "Please select at least one XLSX file." });
          return;
        }

        try {
          set({ status: "reading", error: null });

          const parsedFiles: ParsedSingle380File[] = [];
          const allRows: Single380Row[] = [];

          for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();

            await pauseForUi();
            set({ status: "parsing" });

            const parsed = parseSingle380Workbook(arrayBuffer);
            const fileRows = parsed.rows.map((row) => ({
              ...row,
              sourceFileName: file.name
            }));

            parsedFiles.push({
              sourceFileName: file.name,
              meta: parsed.meta,
              rows: fileRows
            });
            allRows.push(...fileRows);
          }

          await pauseForUi();
          set({ status: "normalizing" });
          const groupedByWell = groupRowsByWell(allRows);

          await pauseForUi();
          set({
            status: "ready",
            error: null,
            files: parsedFiles,
            rows: allRows,
            groupedByWell,
            uploadedAt: new Date().toISOString()
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown parsing error";
          set({ status: "error", error: message });
        }
      },
      clearData: () =>
        set({
          status: "idle",
          error: null,
          files: [],
          rows: [],
          groupedByWell: {},
          uploadedAt: null
        })
    }),
    {
      name: "single-380-data-v1",
      partialize: (state) => ({
        files: state.files,
        rows: state.rows,
        groupedByWell: state.groupedByWell,
        uploadedAt: state.uploadedAt
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        state.status = state.rows.length > 0 ? "ready" : "idle";
        state.error = null;
      }
    }
  )
);

