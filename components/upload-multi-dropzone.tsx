"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadMultiDropzoneProps {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void | Promise<void>;
}

export function UploadMultiDropzone({ disabled, onFilesSelected }: UploadMultiDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        void onFilesSelected(acceptedFiles);
      }
    },
    [onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: true,
    disabled,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Upload 380-Only Files</CardTitle>
        <CardDescription>Drop one or more `.xlsx` files (e.g. HIGH and MEDIUM).</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={cn(
            "cursor-pointer rounded-lg border-2 border-dashed p-8 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            disabled && "cursor-not-allowed opacity-60",
            isDragActive && "border-primary bg-primary/5",
            isDragReject && "border-destructive bg-destructive/5",
            !isDragActive && !isDragReject && "border-border bg-background"
          )}
          aria-disabled={disabled}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3 text-center">
            {isDragActive ? (
              <UploadCloud className="h-10 w-10 text-primary" />
            ) : (
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            )}
            <p className="font-medium">{isDragActive ? "Drop XLSX files here" : "Drag & drop one or more XLSX files"}</p>
            <p className="text-sm text-muted-foreground">This tab parses single-wavelength (380) files without ratio.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

