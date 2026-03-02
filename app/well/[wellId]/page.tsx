import { WellDetailView } from "@/components/well-detail-view";

interface WellPageProps {
  params: {
    wellId: string;
  };
}

export default function WellPage({ params }: WellPageProps) {
  return <WellDetailView wellId={params.wellId} />;
}

