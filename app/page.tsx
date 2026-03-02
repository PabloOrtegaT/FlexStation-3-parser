import { Suspense } from "react";
import { HomeTabs } from "@/components/home-tabs";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <HomeTabs />
    </Suspense>
  );
}
