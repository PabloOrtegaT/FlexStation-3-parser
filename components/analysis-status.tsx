"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AnalysisStatus } from "@/stores/plate-data-store";

interface AnalysisStatusCardProps {
  status: AnalysisStatus;
  error: string | null;
  sourceFileName: string | null;
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

export function AnalysisStatusCard({ status, error, sourceFileName }: AnalysisStatusCardProps) {
  const isBusy = status === "reading" || status === "parsing" || status === "normalizing";

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
      </CardContent>
    </Card>
  );
}

