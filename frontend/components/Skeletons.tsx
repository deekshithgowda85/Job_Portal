import { Card, Skeleton } from "@/components/ui";

export const JobCardSkeleton = () => (
  <Card className="space-y-3 p-4">
    <div className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
    <div className="flex gap-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /></div>
    <Skeleton className="h-9 w-28" />
  </Card>
);

export const JobGridSkeleton = ({ n = 6 }: { n?: number }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{Array.from({ length: n }, (_, i) => <JobCardSkeleton key={i} />)}</div>
);

export const StatRowSkeleton = () => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Card key={i} className="space-y-2 p-5"><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24" /></Card>)}</div>
);

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <Card className="divide-y divide-slate-100">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex gap-4 p-4"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-1/6" /></div>)}</Card>
);

export const FilterSkeleton = () => (
  <div className="space-y-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-full" /></div>)}</div>
);

export const PageTitleSkeleton = () => <div className="mb-6 space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-72" /></div>;
