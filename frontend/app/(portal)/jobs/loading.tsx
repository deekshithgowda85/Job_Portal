import { FilterSkeleton, JobGridSkeleton, PageTitleSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <>
      <PageTitleSkeleton />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[280px]"><FilterSkeleton /></div>
        <div className="flex-1"><JobGridSkeleton /></div>
      </div>
    </>
  );
}
