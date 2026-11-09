import { z } from "zod";
import { JOB_TYPES, SOURCES, WORK_MODES } from "@/lib/types";

const tags = z.array(z.string().trim().min(1).max(60)).max(30).default([]);

export const ruleSchema = z.object({
  name: z.string().trim().min(1, "Give the alert a name").max(80),
  keywords: tags,
  exclude_keywords: tags,
  locations: tags,
  companies: tags,
  job_types: z.array(z.enum(JOB_TYPES)).default([]),
  work_modes: z.array(z.enum(WORK_MODES)).default([]),
  experience_level: z.enum(["any", "fresher", "1-3", "3-5", "5+"]).default("any"),
  sources: z.array(z.enum(SOURCES)).default([]),
  min_salary: z.number().int().min(0).max(1000).nullable().optional(),
  frequency: z.enum(["daily", "instant", "weekly"]).default("daily"),
  is_active: z.boolean().default(true),
});
export const rulePatchSchema = ruleSchema.partial();

export const jobIngestSchema = z.object({
  fingerprint: z.string().min(8).optional(),
  title: z.string().trim().min(1).max(300),
  company: z.string().trim().min(1).max(200),
  company_logo: z.string().url().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  work_mode: z.enum(WORK_MODES).nullable().optional(),
  url: z.string().url(),
  description: z.string().max(50000).nullable().optional(),
  source: z.string().trim().min(1).max(50).transform((s) => s.toLowerCase()),
  job_type: z.enum(JOB_TYPES).nullable().optional(),
  experience_level: z.enum([
    "fresher",
    "junior",
    "mid",
    "senior",
    "lead",
    "unknown",
    "1-3",
    "3-5",
    "5+",
  ]).nullable().optional(),
  salary_min: z.number().int().nonnegative().nullable().optional(),
  salary_max: z.number().int().nonnegative().nullable().optional(),
  salary_range: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(60)).max(40).default([]),
  posted_on: z.string().datetime({ offset: true }).nullable().optional(),
});
export const jobIngestBody = z.array(jobIngestSchema).min(1).max(500);

export const statusSchema = z.object({ status: z.enum(["saved", "applied", "ignored"]).nullable() });
export const crawlTriggerSchema = z.object({ source: z.enum(SOURCES) });
export const crawlLogSchema = z.object({
  source: z.string().min(1).max(50),
  company: z.string().max(200).nullable().optional(),
  status: z.enum(["queued", "running", "success", "error"]),
  jobs_found: z.number().int().nonnegative().default(0),
  jobs_new: z.number().int().nonnegative().default(0),
  error: z.string().max(5000).nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
  run_id: z.string().max(100).nullable().optional(),
  task_index: z.number().int().nonnegative().nullable().optional(),
  total_tasks: z.number().int().positive().nullable().optional(),
});
export const filterPresetSchema = z.object({ name: z.string().trim().min(1).max(60), query_string: z.string().max(2000) });
