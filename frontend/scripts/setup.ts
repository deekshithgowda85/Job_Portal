import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { createHash } from "crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Fill in .env first.");
const sql = neon(url);

async function main() {
  const schema = readFileSync(join(process.cwd(), "lib/db/schema.sql"), "utf8");
  const statements = schema.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
  for (const s of statements) await sql.query(s);
  console.log(`Schema ready (${statements.length} statements).`);

  const name = process.env.OWNER_NAME || "Deekshith";
  const email = process.env.OWNER_EMAIL;
  if (!email) throw new Error("OWNER_EMAIL is not set. Alert emails need a destination.");
  await sql.query(
    `INSERT INTO settings (id, owner_name, owner_email) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET owner_name = EXCLUDED.owner_name, owner_email = EXCLUDED.owner_email`,
    [name, email],
  );
  console.log(`Owner saved: ${name} <${email}>`);

  if (process.argv.includes("--sample")) await seedSamples();
}

async function seedSamples() {
  const titles = ["Java Backend Developer", "Spring Boot Engineer", "Full Stack Developer", "React Frontend Engineer", "DevOps Engineer", "Software Engineer Intern", "Cloud Engineer", "Node.js Developer"];
  const companies = ["Atlassian", "Zoho", "Razorpay", "Swiggy", "Flipkart", "Freshworks", "Postman", "Juspay"];
  const locations = ["Bangalore", "Hyderabad", "Mumbai", "Pune", "Chennai", "Delhi", "Remote"];
  const sources = ["linkedin", "workday", "naukri", "greenhouse", "lever"];
  const types = ["full-time", "full-time", "internship", "contract"];
  const exps = ["fresher", "1-3", "3-5", "5+"];
  const modes = ["onsite", "hybrid", "remote"];
  const skills = ["Java", "Spring Boot", "React", "Docker", "Kubernetes", "AWS", "PostgreSQL", "TypeScript", "Redis"];
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const title = titles[i % titles.length];
    const company = companies[(i * 3) % companies.length];
    const location = locations[(i * 5) % locations.length];
    const source = sources[i % sources.length];
    const exp = exps[i % exps.length];
    const intern = title.includes("Intern");
    const min = intern ? null : (4 + (i % 12)) * 100000;
    const tags = [skills[i % skills.length], skills[(i + 3) % skills.length], skills[(i + 5) % skills.length]];
    const fingerprint = createHash("sha256").update(`sample|${title}|${company}|${location}|${i}`).digest("hex");
    const posted = new Date(Date.now() - (i * 7 + 1) * 3600_000).toISOString();
    const rows = await sql.query(
      `INSERT INTO jobs (fingerprint, title, company, location, work_mode, url, description, source, job_type, experience_level, salary_min, salary_max, tags, posted_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (fingerprint) DO NOTHING RETURNING id`,
      [fingerprint, title, company, location, location === "Remote" ? "remote" : modes[i % 2], `https://example.com/jobs/${i}`,
       `${company} is hiring a ${title} in ${location}.\n\nYou will build and ship services used by millions of people. We work with ${tags.join(", ")}.\n\nWhat we look for:\n- Strong fundamentals\n- Clear communication\n- Interest in owning what you build`,
       source, intern ? "internship" : types[i % types.length], intern ? "fresher" : exp, min, min ? min + 400000 : null, tags, posted],
    );
    n += rows.length;
  }
  console.log(`Sample jobs inserted: ${n}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
