import { Single380WellDetailView } from "@/components/single-380-well-detail-view";

interface Single380WellPageProps {
  params: {
    wellId: string;
  };
}

export default function Single380WellPage({ params }: Single380WellPageProps) {
  return <Single380WellDetailView wellId={params.wellId} />;
}

