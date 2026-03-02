"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Waves } from "lucide-react";
import { PlateReaderDashboard } from "@/components/plate-reader-dashboard";
import { Single380Dashboard } from "@/components/single-380-dashboard";
import { Button } from "@/components/ui/button";

type HomeTab = "ratio" | "single380";

export function HomeTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo<HomeTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "single380" ? "single380" : "ratio";
  }, [searchParams]);

  const setTab = (tab: HomeTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "single380") {
      params.set("tab", "single380");
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 md:px-8">
        <div className="inline-flex items-center gap-2 rounded-xl border bg-card p-1">
          <Button variant={activeTab === "ratio" ? "default" : "ghost"} size="sm" onClick={() => setTab("ratio")}>
            <Activity className="mr-2 h-4 w-4" />
            340/380 + Ratio
          </Button>
          <Button variant={activeTab === "single380" ? "default" : "ghost"} size="sm" onClick={() => setTab("single380")}>
            <Waves className="mr-2 h-4 w-4" />
            380 Only
          </Button>
        </div>
      </div>

      {activeTab === "ratio" ? <PlateReaderDashboard /> : <Single380Dashboard />}
    </div>
  );
}
