export interface Job {
  id: string;
  fingerprint: string;
  title: string;
  company: string;
  company_logo: string | null;
  location: string | null;
  work_mode: string | null;
  url: string;
  description: string | null;
  source: string;
  job_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_range: string | null;
  tags: string[];
  is_active: boolean;
  posted_on: string | null;
  created_at: string;
  my_status?: "saved" | "applied" | "ignored" | null;
}

export interface AlertRule {
  id: string;
  name: string;
  keywords: string[];
  exclude_keywords: string[];
  locations: string[];
  companies: string[];
  job_types: string[];
  work_modes: string[];
  experience_level: string;
  sources: string[];
  min_salary: number | null; // in LPA
  frequency: "daily" | "instant" | "weekly";
  is_active: boolean;
  created_at: string;
}

export interface FacetItem { value: string; count: number }
export type Facets = Record<"location" | "company" | "source" | "jobType" | "workMode" | "tag", FacetItem[]>;

export const SOURCES = ["linkedin", "workday", "naukri", "greenhouse", "lever", "generic"] as const;
export const JOB_TYPES = ["full-time", "part-time", "internship", "contract"] as const;
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const EXPERIENCE = [
  { value: "any", label: "Any" },
  { value: "fresher", label: "Fresher" },
  { value: "1-3", label: "1-3 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "5+", label: "5+ years" },
] as const;
export const DEFAULT_LOCATIONS = ["Bangalore", "Mumbai", "Delhi", "Hyderabad", "Pune", "Chennai", "Remote"];
