"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Reads and writes job filters in the URL so every filtered view is shareable. */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const push = useCallback(
    (next: URLSearchParams) => {
      next.delete("page");
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  const set = useCallback(
    (key: string, value: string | null) => {
      const n = new URLSearchParams(sp.toString());
      if (value === null || value === "") n.delete(key);
      else n.set(key, value);
      push(n);
    },
    [sp, push],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const n = new URLSearchParams(sp.toString());
      const cur = n.getAll(key);
      n.delete(key);
      (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) => n.append(key, v));
      push(n);
    },
    [sp, push],
  );

  const clearAll = useCallback(() => {
    const n = new URLSearchParams();
    const sort = sp.get("sort");
    if (sort) n.set("sort", sort);
    push(n);
  }, [sp, push]);

  return { sp, pending, set, toggle, push, clearAll };
}
