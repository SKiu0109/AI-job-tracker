import { ImportInboxPage } from "@/components/jobs/import-inbox-page";
import { SAMPLE_JD, SAMPLE_SOURCE_URL } from "@/lib/sample-jd";

type AddJobPageProps = {
  searchParams?: Promise<{
    sample?: string;
  }>;
};

export default async function AddJobPage({ searchParams }: AddJobPageProps) {
  const params = await searchParams;
  const shouldUseSample = params?.sample === "1";

  return (
    <ImportInboxPage
      initialRawJd={shouldUseSample ? SAMPLE_JD : ""}
      initialSourceUrl={shouldUseSample ? SAMPLE_SOURCE_URL : ""}
      samplePrefilled={shouldUseSample}
    />
  );
}
