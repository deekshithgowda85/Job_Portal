import JobCard from "@/components/JobCard";
import { EmptyState, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import type { Job } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company careers · JobAlert" };

const CAREER_KEYWORDS = [
  "java", "spring boot", "backend", "software engineer", "sde", "associate software engineer",
  "graduate engineer trainee", "devops", "devsecops", "site reliability", "sre",
  "kubernetes", "platform engineer", "cloud engineer", "full stack", "react", "next.js",
  "node", "llm", "generative ai", "ai engineer", "intern", "2027 batch", "fresher",
  "entry level", "graduate",
];

export default async function CompanyCareersPage() {
  const jobs = await query<Job>(
    `SELECT j.*, js.status AS my_status
       FROM jobs j
       LEFT JOIN job_status js ON js.job_id = j.id
      WHERE j.is_active = true
        AND j.source = 'generic'
        AND j.experience_level IN ('fresher', 'junior')
        AND (${CAREER_KEYWORDS.map((keyword) => `LOWER(COALESCE(j.title, '') || ' ' || COALESCE(j.description, '')) LIKE '%${keyword.replace(/'/g, "''")}%'`).join(" OR ")})
      ORDER BY COALESCE(j.posted_on, j.created_at) DESC
      LIMIT 200`,
  );

  return (
    <>
      <PageHeader title="Company careers" subtitle="Freshers and 1–3 year jobs found on company career portals." />
      {jobs.length === 0 ? (
        <EmptyState title="No company-career jobs yet" hint="Run the company career crawl and refresh this page." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
      )}
    </>
  );
}
