"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadDropzoneProps {
  disabled?: boolean;
  onFileSelected: (file: File) => void | Promise<void>;
}

export function UploadDropzone({ disabled, onFileSelected }: UploadDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        void onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Upload Plate Reader File</CardTitle>
        <CardDescription>Drop your `.xlsx` file or click to browse.</CardDescription>
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
            <p className="font-medium">{isDragActive ? "Drop the XLSX file here" : "Drag & drop your XLSX file"}</p>
            <p className="text-sm text-muted-foreground">Only `.xlsx` files are accepted for this parser.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

