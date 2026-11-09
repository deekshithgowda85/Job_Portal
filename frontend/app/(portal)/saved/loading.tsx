import { JobGridSkeleton, PageTitleSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <PageTitleSkeleton />
      <JobGridSkeleton n={4} />
    </>
  );
}
