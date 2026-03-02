"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Beaker, FlaskConical, Trash2 } from "lucide-react";
import { AnalysisStatusCard } from "@/components/analysis-status";
import { PlateGrid } from "@/components/plate-grid";
import { UploadDropzone } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlateDataStore } from "@/stores/plate-data-store";

function prettyDate(iso: string | null): string {
  if (!iso) {
    return "--";
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
}

export function PlateReaderDashboard() {
  const { status, error, meta, groupedByWell, rows, sourceFileName, uploadedAt, analyzeFile, clearData } = usePlateDataStore();

  const busy = status === "reading" || status === "parsing" || status === "normalizing";

  const gridSummaries = useMemo(() => {
    const summaries: Record<string, { hasData: boolean; latestRatio: number | null; timepoints: number }> = {};
    for (const [wellId, series] of Object.entries(groupedByWell)) {
      const latest = series[series.length - 1];
      summaries[wellId] = {
        hasData: series.length > 0,
        latestRatio: latest?.ratio ?? null,
        timepoints: series.length
      };
    }
    return summaries;
  }, [groupedByWell]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <FlaskConical className="h-4 w-4 text-primary" />
          Next.js Plate Reader Viewer
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold md:text-3xl">24x16 Interactive Well Grid</h1>
            <p className="text-sm text-muted-foreground">
              Upload old machine `.xlsx` files, normalize 340/380 measurements, and inspect per-well time-series.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/well/A3">Open A3 detail</Link>
            </Button>
            <Button variant="secondary" onClick={clearData} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear data
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <UploadDropzone disabled={busy} onFileSelected={analyzeFile} />
        <AnalysisStatusCard status={status} error={error} sourceFileName={sourceFileName} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dataset Summary</CardTitle>
            <CardDescription>Live snapshot of normalized output.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Rows parsed: <span className="font-semibold">{rows.length}</span>
            </p>
            <p>
              Wells with data: <span className="font-semibold">{Object.keys(groupedByWell).length}</span>
            </p>
            <p>
              Uploaded at: <span className="font-semibold">{prettyDate(uploadedAt)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detected Layout</CardTitle>
            <CardDescription>Computed automatically from worksheet content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Header row: <span className="font-semibold">{meta?.headerRow1Based ?? "--"}</span>
            </p>
            <p>
              340 start: <span className="font-semibold">{meta ? `${meta.colStart340Label} (${meta.colStart3401Based})` : "--"}</span>
            </p>
            <p>
              380 start: <span className="font-semibold">{meta ? `${meta.colStart380Label} (${meta.colStart3801Based})` : "--"}</span>
            </p>
            <p>
              Cycle stride: <span className="font-semibold">{meta?.cycleStride ?? "--"}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Access</CardTitle>
            <CardDescription>Go directly to any well detail view.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col justify-between text-sm">
            <p className="text-muted-foreground">Each tile in the grid opens a dedicated detail route.</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/well/A1">
                <Beaker className="mr-2 h-4 w-4" />
                Browse Well Details
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Plate Map</h2>
        <p className="text-sm text-muted-foreground">
          Each cell shows the latest ratio and number of timepoints. Click any cell to open the well detail page.
        </p>
        <PlateGrid summaries={gridSummaries} />
      </section>
    </main>
  );
}
