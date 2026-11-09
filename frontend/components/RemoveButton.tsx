"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { btnSecondary } from "@/components/ui";

export default function RemoveButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className={btnSecondary}
      onClick={async () => {
        await fetch(`/api/jobs/${jobId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: null }) });
        start(() => router.refresh());
      }}
    >
      {pending ? "Removing" : "Remove"}
    </button>
  );
}
