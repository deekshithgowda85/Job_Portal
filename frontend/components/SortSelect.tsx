"use client";

import { useUrlFilters } from "@/components/useUrlFilters";
import { inputCls } from "@/components/ui";

export default function SortSelect({ hasQuery }: { hasQuery: boolean }) {
  const { sp, set } = useUrlFilters();
  const value = sp.get("sort") ?? (hasQuery ? "relevance" : "latest");
  return (
    <label className="flex items-center gap-2 text-sm text-slate-500">
      Sort
      <select className={`${inputCls} w-auto`} value={value} onChange={(e) => set("sort", e.target.value === "latest" ? null : e.target.value)}>
        <option value="latest">Latest</option>
        <option value="relevance" disabled={!hasQuery}>Relevance</option>
        <option value="salary">Salary, high to low</option>
      </select>
    </label>
  );
}
