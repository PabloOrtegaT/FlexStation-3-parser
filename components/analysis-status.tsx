"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, MousePointerClick } from "lucide-react";
import { type GroupedByWell, type WellTimepointRow } from "@/lib/plate-reader-parser";
import { downloadMultiSheetWellOutputXlsx, downloadPerWellOutputXlsx, type WellSheetSelection } from "@/lib/xlsx-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AnalysisStatus } from "@/stores/plate-data-store";

interface AnalysisStatusCardProps {
  status: AnalysisStatus;
  error: string | null;
  sourceFileName: string | null;
  rows: WellTimepointRow[];
  groupedByWell: GroupedByWell;
  selectionMode: boolean;
  selectedWellIds: string[];
  onToggleSelectionMode: () => void;
  onClearSelection: () => void;
}

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  idle: "Idle",
  reading: "Reading file",
  parsing: "Parsing worksheet",
  normalizing: "Normalizing wells",
  ready: "Ready",
  error: "Error"
};

const STATUS_DETAILS: Record<AnalysisStatus, string> = {
  idle: "Upload a workbook to start analysis.",
  reading: "Reading file bytes from your browser.",
  parsing: "Detecting 340nm/380nm layout and cycle structure.",
  normalizing: "Building normalized per-well time-series data.",
  ready: "Analysis complete. Grid and well pages are updated.",
  error: "Could not analyze the workbook."
};
const SHEET_BUILDER_STORAGE_KEY = "plate-reader-multi-sheet-builder-v2";
const INPUT_CLASS =
  "h-8 rounded-md border bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

function isValidWellId(wellId: string): boolean {
  return /^[A-P](?:[1-9]|1[0-9]|2[0-4])$/.test(wellId);
}

export function AnalysisStatusCard({
  status,
  error,
  sourceFileName,
  rows,
  groupedByWell,
  selectionMode,
  selectedWellIds,
  onToggleSelectionMode,
  onClearSelection
}: AnalysisStatusCardProps) {
  const isBusy = status === "reading" || status === "parsing" || status === "normalizing";
  const [isExporting, setIsExporting] = useState(false);
  const [sheetSelections, setSheetSelections] = useState<WellSheetSelection[]>([]);
  const hasRestoredSheetBuilder = useRef(false);
  const canExport = status === "ready" && rows.length > 0;
  const canExportSelected = canExport && selectedWellIds.length > 0;
  const selectedExportWellIds = useMemo(
    () => [...new Set(selectedWellIds)].filter((wellId) => groupedByWell[wellId]).sort(compareWellIds),
    [groupedByWell, selectedWellIds]
  );
  const canAddSheetSelection = canExport && selectedExportWellIds.length > 0;
  const canDownloadMultiSheet = canExport && sheetSelections.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(SHEET_BUILDER_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const restored: WellSheetSelection[] = parsed
            .map((entry, idx) => {
              if (!entry || typeof entry !== "object") {
                return null;
              }

              const sheetName = typeof entry.sheetName === "string" && entry.sheetName.trim() ? entry.sheetName : `Sheet ${idx + 1}`;
              const wells = Array.isArray(entry.wells)
                ? (entry.wells as unknown[])
                    .filter(
                      (well: unknown): well is { wellId: string; label: string } => {
                        if (!well || typeof well !== "object") {
                          return false;
                        }

                        const candidate = well as { wellId?: unknown; label?: unknown };
                        return typeof candidate.wellId === "string" && isValidWellId(candidate.wellId) && typeof candidate.label === "string";
                      }
                    )
                    .map((well) => ({
                      wellId: well.wellId,
                      label: well.label
                    }))
                : [];

              if (wells.length === 0) {
                return null;
              }

              return {
                sheetName,
                wells
              };
            })
            .filter((entry): entry is WellSheetSelection => Boolean(entry));

          if (restored.length > 0) {
            setSheetSelections(restored);
          }
        }
      } catch {
        // Ignore corrupted local storage payloads.
      }
    }

    hasRestoredSheetBuilder.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!hasRestoredSheetBuilder.current) {
      return;
    }

    window.localStorage.setItem(SHEET_BUILDER_STORAGE_KEY, JSON.stringify(sheetSelections));
  }, [sheetSelections]);

  const handlePerWellExport = () => {
    if (!canExport) {
      return;
    }

    setIsExporting(true);
    try {
      downloadPerWellOutputXlsx(groupedByWell, sourceFileName);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectedExport = () => {
    if (!canExportSelected) {
      return;
    }

    setIsExporting(true);
    try {
      downloadPerWellOutputXlsx(groupedByWell, sourceFileName, selectedWellIds);
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddSheetSelection = () => {
    if (!canAddSheetSelection) {
      return;
    }

    setSheetSelections((prev) => [
      ...prev,
      {
        sheetName: `Sheet ${prev.length + 1}`,
        wells: selectedExportWellIds.map((wellId) => ({
          wellId,
          label: wellId
        }))
      }
    ]);
    onClearSelection();
  };

  const handleRemoveSheetSelection = (index: number) => {
    setSheetSelections((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDownloadMultiSheet = () => {
    if (!canDownloadMultiSheet) {
      return;
    }

    setIsExporting(true);
    try {
      downloadMultiSheetWellOutputXlsx(groupedByWell, sourceFileName, sheetSelections);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSheetNameChange = (index: number, sheetName: string) => {
    setSheetSelections((prev) =>
      prev.map((sheet, idx) =>
        idx === index
          ? {
              ...sheet,
              sheetName
            }
          : sheet
      )
    );
  };

  const handleWellLabelChange = (sheetIndex: number, wellId: string, label: string) => {
    setSheetSelections((prev) =>
      prev.map((sheet, idx) =>
        idx === sheetIndex
          ? {
              ...sheet,
              wells: sheet.wells.map((well) => (well.wellId === wellId ? { ...well, label } : well))
            }
          : sheet
      )
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Analysis Status</CardTitle>
        <Badge variant={status === "error" ? "destructive" : status === "ready" ? "default" : "secondary"}>
          {STATUS_LABELS[status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {isBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {status === "ready" && <CheckCircle2 className="h-4 w-4 text-primary" />}
          {status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
          <span>{STATUS_DETAILS[status]}</span>
        </div>
        {sourceFileName && <p className="text-xs text-muted-foreground">Source file: {sourceFileName}</p>}
        {status === "error" && error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={handlePerWellExport} disabled={!canExport || isExporting}>
            <Download className="mr-2 h-4 w-4" />
            Download table XLSX
          </Button>
          <Button variant={selectionMode ? "secondary" : "outline"} size="sm" onClick={onToggleSelectionMode} disabled={!canExport || isExporting}>
            <MousePointerClick className="mr-2 h-4 w-4" />
            {selectionMode ? "Stop selecting wells" : "Select wells"}
          </Button>
          {selectionMode && (
            <>
              <Button variant="outline" size="sm" onClick={handleSelectedExport} disabled={!canExportSelected || isExporting}>
                <Download className="mr-2 h-4 w-4" />
                Download selected wells XLSX
              </Button>
              <Button variant="outline" size="sm" onClick={onClearSelection} disabled={selectedWellIds.length === 0 || isExporting}>
                Clear selected ({selectedWellIds.length})
              </Button>
            </>
          )}
        </div>
        {selectionMode && <p className="text-xs text-muted-foreground">Selection mode enabled: click wells in the plate map to select/deselect.</p>}

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Multi-Sheet Builder</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleAddSheetSelection} disabled={!canAddSheetSelection || isExporting}>
              Add new sheet ({selectedExportWellIds.length} selected)
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadMultiSheet} disabled={!canDownloadMultiSheet || isExporting}>
              <Download className="mr-2 h-4 w-4" />
              Download multi-sheet XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSheetSelections([])} disabled={sheetSelections.length === 0 || isExporting}>
              Clear sheets ({sheetSelections.length})
            </Button>
          </div>

          {sheetSelections.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Create sheets from selected wells, rename tabs/wells, add more sheets with different selections, then download.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {sheetSelections.map((sheet, index) => (
                <div key={`sheet-${index}`} className="space-y-2 rounded-sm border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-muted-foreground">Sheet name</span>
                    <input
                      className={INPUT_CLASS}
                      value={sheet.sheetName}
                      onChange={(event) => handleSheetNameChange(index, event.target.value)}
                      placeholder={`Sheet ${index + 1}`}
                    />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleRemoveSheetSelection(index)}>
                      Remove
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {sheet.sheetName || `Sheet ${index + 1}`} -{" "}
                    {sheet.wells
                      .map((well) => {
                        const label = well.label.trim();
                        return label && label !== well.wellId ? `${label} (${well.wellId})` : well.wellId;
                      })
                      .join(", ")}
                  </p>
                  <div className="grid gap-1 md:grid-cols-2">
                    {sheet.wells.map((well) => (
                      <label key={`sheet-${index}-well-${well.wellId}`} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 font-medium text-muted-foreground">{well.wellId}</span>
                        <input
                          className={`${INPUT_CLASS} w-full`}
                          value={well.label}
                          onChange={(event) => handleWellLabelChange(index, well.wellId, event.target.value)}
                          placeholder={well.wellId}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
