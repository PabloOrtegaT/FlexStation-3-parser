import { z } from "zod";

export const WellTimepointRowSchema = z.object({
  wellId: z.string().regex(/^[A-P](?:[1-9]|1[0-9]|2[0-4])$/),
  plateRow: z.string().regex(/^[A-P]$/),
  plateCol: z.number().int().min(1).max(24),
  timepointIndex: z.number().int().min(0),
  t340: z.number().nullable(),
  f340: z.number().nullable(),
  t380: z.number().nullable(),
  f380: z.number().nullable(),
  ratio: z.number().nullable()
});

export const ParseMetaSchema = z.object({
  sheetName: z.string(),
  headerRow1Based: z.number().int().positive(),
  colStart3401Based: z.number().int().positive(),
  colStart340Label: z.string().min(1),
  colStart3801Based: z.number().int().positive(),
  colStart380Label: z.string().min(1),
  firstCycleStartRow1Based: z.number().int().positive(),
  cycleStride: z.number().int().positive()
});

export const ParseOutputSchema = z.object({
  meta: ParseMetaSchema,
  rows: z.array(WellTimepointRowSchema)
});

