import { Suspense } from "react";
import { redirect } from "next/navigation";
import ActiveChips from "@/components/ActiveChips";
import FilterPanel from "@/components/FilterPanel";
import JobCard from "@/components/JobCard";
import Pagination from "@/components/Pagination";
import { FilterSkeleton, JobGridSkeleton } from "@/components/Skeletons";
import SortSelect from "@/components/SortSelect";
import { EmptyState, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { PAGE_SIZE, filtersToParams, getFacets, parseFilters, queryJobs, type JobFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs · JobAlert" };

type SP = Record<string, string | string[] | undefined>;

async function Sidebar({ filters }: { filters: JobFilters }) {
  const [facets, presets] = await Promise.all([getFacets(filters), query<{ id: string; name: string; query_string: string }>("SELECT id, name, query_string FROM saved_filters ORDER BY created_at DESC")]);
  return <FilterPanel facets={facets} presets={presets} />;
}

async function Results({ filters }: { filters: JobFilters }) {
  const { jobs, total, page } = await queryJobs(filters);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-500">Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} jobs</p>
        <SortSelect hasQuery={!!filters.q} />
      </div>
      {jobs.length === 0 ? (
        <EmptyState title="No jobs match these filters" hint="Try removing a filter or searching with fewer words." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/jobs" params={filtersToParams(filters)} />
    </>
  );
}

export default function JobsPage({ searchParams }: { searchParams: SP }) {
  if (!searchParams.status) redirect("/jobs?status=all");
  const filters = parseFilters(searchParams);
  const key = JSON.stringify(searchParams);
  return (
    <>
      <PageHeader title="Jobs" subtitle="Search and filter every job the crawlers found." />
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[280px]">
          <Suspense fallback={<FilterSkeleton />}><Sidebar filters={filters} /></Suspense>
        </aside>
        <section className="min-w-0 flex-1">
          <ActiveChips />
          <Suspense key={key} fallback={<JobGridSkeleton />}><Results filters={filters} /></Suspense>
        </section>
      </div>
    </>
  );
}
