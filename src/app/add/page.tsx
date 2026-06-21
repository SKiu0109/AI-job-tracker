import { AddJobForm } from "@/components/jobs/add-job-form";
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
    <AddJobForm
      initialRawJd={shouldUseSample ? SAMPLE_JD : ""}
      initialSourceUrl={shouldUseSample ? SAMPLE_SOURCE_URL : ""}
      samplePrefilled={shouldUseSample}
    />
  );
}
