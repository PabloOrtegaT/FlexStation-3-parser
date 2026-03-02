import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plate Reader Viewer",
  description: "Upload old machine XLSX files and inspect normalized well time-series."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

