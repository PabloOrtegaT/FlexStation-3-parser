"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, MousePointerClick } from "lucide-react";
import { downloadSingle380PerWellXlsx } from "@/lib/single-380-export";
import { type Single380Row } from "@/lib/single-380-parser";
import { type ParsedSingle380File, type Single380AnalysisStatus } from "@/stores/single-380-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Single380AnalysisStatusCardProps {
  status: Single380AnalysisStatus;
  error: string | null;
  files: ParsedSingle380File[];
  rows: Single380Row[];
  groupedByWell: Record<string, Single380Row[]>;
  selectionMode: boolean;
  selectedWellIds: string[];
  onToggleSelectionMode: () => void;
  onClearSelection: () => void;
}

const STATUS_LABELS: Record<Single380AnalysisStatus, string> = {
  idle: "Idle",
  reading: "Reading files",
  parsing: "Parsing worksheets",
  normalizing: "Normalizing wells",
  ready: "Ready",
  error: "Error"
};

const STATUS_DETAILS: Record<Single380AnalysisStatus, string> = {
  idle: "Upload one or more 380-only workbooks to start analysis.",
  reading: "Reading file bytes from your browser.",
  parsing: "Detecting 380nm layout and cycle structure.",
  normalizing: "Building normalized per-well 380 time-series data.",
  ready: "Analysis complete. 380 plate map and details are updated.",
  error: "Could not analyze the workbook(s)."
};

export function Single380AnalysisStatusCard({
  status,
  error,
  files,
  rows,
  groupedByWell,
  selectionMode,
  selectedWellIds,
  onToggleSelectionMode,
  onClearSelection
}: Single380AnalysisStatusCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const isBusy = status === "reading" || status === "parsing" || status === "normalizing";
  const canExport = status === "ready" && rows.length > 0;
  const canExportSelected = canExport && selectedWellIds.length > 0;

  const sourceFileNames = useMemo(() => files.map((file) => file.sourceFileName), [files]);

  const handleAllExport = () => {
    if (!canExport) {
      return;
    }
    setIsExporting(true);
    try {
      downloadSingle380PerWellXlsx(groupedByWell, sourceFileNames);
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
      downloadSingle380PerWellXlsx(groupedByWell, sourceFileNames, selectedWellIds);
    } finally {
      setIsExporting(false);
    }
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
        {files.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Source files: {files.map((file) => file.sourceFileName).join(", ")}
          </p>
        )}
        {status === "error" && error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={handleAllExport} disabled={!canExport || isExporting}>
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
      </CardContent>
    </Card>
  );
}

