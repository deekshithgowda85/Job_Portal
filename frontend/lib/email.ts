import { Resend } from "resend";
import JobAlertEmail, { type JobAlertEmailProps } from "@/emails/JobAlertEmail";

export async function sendAlertEmail(to: string, props: JobAlertEmailProps): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  if (!to) throw new Error("Owner email is not set (OWNER_EMAIL or settings table)");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Job Alerts <onboarding@resend.dev>",
    to,
    subject: `${props.totalMatches} new job${props.totalMatches === 1 ? "" : "s"}: ${props.ruleName}`,
    react: JobAlertEmail(props),
  });
  if (error) throw new Error(error.message);
}
