"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/company-careers", label: "Company careers" },
  { href: "/queue", label: "Crawl queue" },
  { href: "/alerts", label: "Alerts" },
  { href: "/saved", label: "Saved" },
  { href: "/history", label: "History" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
        <span className="text-base font-bold">JobAlert</span>
        <button aria-label="Toggle menu" onClick={() => setOpen((o) => !o)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <aside className={cn("w-full shrink-0 border-slate-100 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-56 lg:border-r", open ? "block border-b" : "hidden")}>
        <div className="hidden px-6 py-6 text-lg font-bold lg:block">JobAlert</div>
        <nav className="flex flex-col gap-1 p-3 lg:pt-0">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn("rounded-lg px-3 py-2 text-sm font-medium", active(l.href) ? "bg-blue-50 text-blue-600" : "text-slate-600")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
