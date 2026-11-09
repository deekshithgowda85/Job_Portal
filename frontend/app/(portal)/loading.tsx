import { PageTitleSkeleton, StatRowSkeleton, TableSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageTitleSkeleton />
      <StatRowSkeleton />
      <TableSkeleton />
    </div>
  );
}
