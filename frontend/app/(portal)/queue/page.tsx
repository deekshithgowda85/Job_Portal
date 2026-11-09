import QueueView from "@/components/QueueView";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Crawl queue · JobAlert" };

export default function QueuePage() {
  return (
    <>
      <PageHeader title="Crawl queue" subtitle="Live progress for the current company-portal run. This page refreshes automatically." />
      <QueueView />
    </>
  );
}
