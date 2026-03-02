"use client";

import Link from "next/link";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSingle380Store } from "@/stores/single-380-store";

const LINE_COLORS = ["#0f766e", "#d97706", "#2563eb", "#b45309", "#be123c", "#4338ca", "#15803d", "#0ea5e9"];

interface Single380WellDetailViewProps {
  wellId: string;
}

function formatNum(value: number | null, digits = 4): string {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
}

function normalizeWellId(raw: string): string {
  return raw.trim().toUpperCase();
}

function isValidWellId(wellId: string): boolean {
  return /^[A-P](?:[1-9]|1[0-9]|2[0-4])$/.test(wellId);
}

export function Single380WellDetailView({ wellId }: Single380WellDetailViewProps) {
  const normalizedWellId = normalizeWellId(wellId);
  const { groupedByWell, files } = useSingle380Store();

  const series = groupedByWell[normalizedWellId] ?? [];
  const fileNames = [...new Set(series.map((row) => row.sourceFileName))].sort((a, b) => a.localeCompare(b));

  const latestByFile = fileNames.map((fileName) => {
    const rowsForFile = series.filter((row) => row.sourceFileName === fileName).sort((a, b) => b.timepointIndex - a.timepointIndex);
    return { fileName, latest: rowsForFile[0] };
  });

  const f380ChartData = (() => {
    const byTimepoint = new Map<number, Record<string, number | string | null>>();
    for (const row of series) {
      if (!byTimepoint.has(row.timepointIndex)) {
        byTimepoint.set(row.timepointIndex, { timepointIndex: row.timepointIndex });
      }
      byTimepoint.get(row.timepointIndex)![row.sourceFileName] = row.f380;
    }
    return [...byTimepoint.values()].sort((a, b) => Number(a.timepointIndex) - Number(b.timepointIndex));
  })();

  if (!isValidWellId(normalizedWellId)) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Button asChild variant="outline">
          <Link href="/?tab=single380">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to 380 grid
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid well id</AlertTitle>
          <AlertDescription>Route parameter "{wellId}" is not a valid well id (expected A1..P24).</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (Object.keys(groupedByWell).length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Button asChild variant="outline">
          <Link href="/?tab=single380">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to 380 grid
          </Link>
        </Button>
        <Alert>
          <AlertTitle>No dataset loaded</AlertTitle>
          <AlertDescription>Upload one or more 380-only XLSX files in the 380 tab to inspect well-level details.</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (series.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Button asChild variant="outline">
          <Link href="/?tab=single380">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to 380 grid
          </Link>
        </Button>
        <Alert>
          <AlertTitle>Well has no data</AlertTitle>
          <AlertDescription>No normalized records were found for well {normalizedWellId} in the loaded 380 file set.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-3">
        <Button asChild variant="outline">
          <Link href="/?tab=single380">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to 380 grid
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Well {normalizedWellId}</h1>
          <Badge>{series.length} records</Badge>
          <Badge variant="secondary">{fileNames.length} files</Badge>
          {files.length > 0 && <Badge variant="secondary">{files.map((file) => file.sourceFileName).join(", ")}</Badge>}
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Latest Snapshot Per File</CardTitle>
          <CardDescription>Most recent t380/f380 values per source file.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {latestByFile.map(({ fileName, latest }) => (
            <div key={fileName} className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">{fileName}</p>
              <p>
                timepoint: <span className="font-medium">{latest?.timepointIndex ?? "--"}</span>
              </p>
              <p>
                t380: <span className="font-medium">{formatNum(latest?.t380 ?? null)}</span>
              </p>
              <p>
                f380: <span className="font-medium">{formatNum(latest?.f380 ?? null)}</span>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">f380 Curve</CardTitle>
            <CardDescription>One line per loaded file.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={f380ChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timepointIndex" />
                <YAxis />
                <Tooltip />
                <Legend />
                {fileNames.map((fileName, idx) => (
                  <Line key={fileName} type="monotone" dataKey={fileName} stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Raw 380 Records</CardTitle>
          <CardDescription>Normalized rows for this well (no ratio field).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>sourceFileName</TableHead>
                <TableHead>timepointIndex</TableHead>
                <TableHead>t380</TableHead>
                <TableHead>f380</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((row, idx) => (
                <TableRow key={`${row.sourceFileName}-${row.timepointIndex}-${idx}`}>
                  <TableCell>{row.sourceFileName}</TableCell>
                  <TableCell>{row.timepointIndex}</TableCell>
                  <TableCell>{formatNum(row.t380, 4)}</TableCell>
                  <TableCell>{formatNum(row.f380, 4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
