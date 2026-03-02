"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type GroupedByWell,
  type ParseMeta,
  type WellTimepointRow,
  groupByWell,
  parsePlateReaderWorkbook
} from "@/lib/plate-reader-parser";
import { ParseOutputSchema } from "@/lib/schemas";

export type AnalysisStatus = "idle" | "reading" | "parsing" | "normalizing" | "ready" | "error";

export interface PlateDataState {
  status: AnalysisStatus;
  error: string | null;
  meta: ParseMeta | null;
  rows: WellTimepointRow[];
  groupedByWell: GroupedByWell;
  sourceFileName: string | null;
  uploadedAt: string | null;
  analyzeFile: (file: File) => Promise<void>;
  clearData: () => void;
}

const pauseForUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const usePlateDataStore = create<PlateDataState>()(
  persist(
    (set) => ({
      status: "idle",
      error: null,
      meta: null,
      rows: [],
      groupedByWell: {},
      sourceFileName: null,
      uploadedAt: null,
      analyzeFile: async (file) => {
        try {
          set({ status: "reading", error: null });
          const arrayBuffer = await file.arrayBuffer();

          await pauseForUi();
          set({ status: "parsing" });
          const parsed = parsePlateReaderWorkbook(arrayBuffer);
          const validated = ParseOutputSchema.parse(parsed);

          await pauseForUi();
          set({ status: "normalizing" });
          const grouped = groupByWell(validated.rows);

          await pauseForUi();
          set({
            status: "ready",
            error: null,
            meta: validated.meta,
            rows: validated.rows,
            groupedByWell: grouped,
            sourceFileName: file.name,
            uploadedAt: new Date().toISOString()
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown parsing error";
          set({
            status: "error",
            error: message
          });
        }
      },
      clearData: () =>
        set({
          status: "idle",
          error: null,
          meta: null,
          rows: [],
          groupedByWell: {},
          sourceFileName: null,
          uploadedAt: null
        })
    }),
    {
      name: "plate-reader-data-v1",
      partialize: (state) => ({
        meta: state.meta,
        rows: state.rows,
        groupedByWell: state.groupedByWell,
        sourceFileName: state.sourceFileName,
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

