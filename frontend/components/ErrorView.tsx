"use client";

import { btnPrimary } from "@/components/ui";

export default function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-slate-500">{error.message || "This page could not be loaded. Check your database connection and try again."}</p>
      <button onClick={reset} className={`${btnPrimary} mt-6`}>Try again</button>
    </div>
  );
}
