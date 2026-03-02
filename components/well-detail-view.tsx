"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlateDataStore } from "@/stores/plate-data-store";

interface WellDetailViewProps {
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

export function WellDetailView({ wellId }: WellDetailViewProps) {
  const normalizedWellId = normalizeWellId(wellId);
  const { groupedByWell, sourceFileName } = usePlateDataStore();

  const series = groupedByWell[normalizedWellId] ?? [];
  const latest = series[series.length - 1];

  if (!isValidWellId(normalizedWellId)) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to grid
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
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to grid
          </Link>
        </Button>
        <Alert>
          <AlertTitle>No dataset loaded</AlertTitle>
          <AlertDescription>Upload an XLSX file on the home page to inspect well-level details.</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (series.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 md:p-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to grid
          </Link>
        </Button>
        <Alert>
          <AlertTitle>Well has no data</AlertTitle>
          <AlertDescription>No normalized records were found for well {normalizedWellId} in this file.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-3">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to grid
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Well {normalizedWellId}</h1>
          <Badge>{series.length} timepoints</Badge>
          {sourceFileName && <Badge variant="secondary">{sourceFileName}</Badge>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest Snapshot</CardTitle>
            <CardDescription>Most recent values for this well.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">t340</p>
              <p className="font-semibold">{formatNum(latest.t340)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">f340</p>
              <p className="font-semibold">{formatNum(latest.f340)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">t380</p>
              <p className="font-semibold">{formatNum(latest.t380)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">f380</p>
              <p className="font-semibold">{formatNum(latest.f380)}</p>
            </div>
            <div className="col-span-2 rounded-md border bg-muted/40 p-3">
              <p className="text-muted-foreground">ratio</p>
              <p className="text-xl font-semibold">{formatNum(latest.ratio, 6)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fluorescence Curves</CardTitle>
            <CardDescription>f340 and f380 over timepoint index.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timepointIndex" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="f340" stroke="#d97706" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="f380" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ratio Trend</CardTitle>
          <CardDescription>Computed as f340 / f380</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timepointIndex" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="ratio" stroke="#7c2d12" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Raw Timepoint Table</CardTitle>
          <CardDescription>Normalized records used for analysis and charting.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>timepointIndex</TableHead>
                <TableHead>t340</TableHead>
                <TableHead>f340</TableHead>
                <TableHead>t380</TableHead>
                <TableHead>f380</TableHead>
                <TableHead>ratio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((point) => (
                <TableRow key={`${normalizedWellId}-${point.timepointIndex}`}>
                  <TableCell>{point.timepointIndex}</TableCell>
                  <TableCell>{formatNum(point.t340)}</TableCell>
                  <TableCell>{formatNum(point.f340)}</TableCell>
                  <TableCell>{formatNum(point.t380)}</TableCell>
                  <TableCell>{formatNum(point.f380)}</TableCell>
                  <TableCell>{formatNum(point.ratio, 6)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

