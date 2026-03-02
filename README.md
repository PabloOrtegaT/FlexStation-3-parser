# Plate Reader Viewer (Next.js)

This app ingests old plate-reader `.xlsx` files, detects the 340nm/380nm layout, normalizes time-series per well, and renders:

- A 24x16 interactive plate grid (`A1..P24`)
- Per-well detail routes (`/well/[wellId]`) with charts and raw normalized table

## Tech

- Next.js + TypeScript (App Router)
- shadcn-style UI components
- `xlsx` (SheetJS)
- `react-dropzone`
- `recharts`
- `zod`
- `zustand` with localStorage persistence

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload an `.xlsx`, then click a well tile.

## Test parser

```bash
npm run test
```

The parser test validates sample well `A3` against expected first 3 values from `4_5850732217298329244.xlsx`.

