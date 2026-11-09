import { Body, Button, Container, Font, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

export interface EmailJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  source: string;
  url: string;
}

export interface JobAlertEmailProps {
  name: string;
  ruleName: string;
  jobs: EmailJob[];
  totalMatches: number;
  viewAllUrl: string;
  manageUrl: string;
}

const font = "Inter, -apple-system, 'Segoe UI', Arial, sans-serif";

export default function JobAlertEmail({ name, ruleName, jobs, totalMatches, viewAllUrl, manageUrl }: JobAlertEmailProps) {
  const shown = jobs.slice(0, 20);
  return (
    <Html>
      <Head>
        <Font fontFamily="Inter" fallbackFontFamily="Arial" webFont={{ url: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2", format: "woff2" }} fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>{`${totalMatches} new jobs matching ${ruleName}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", margin: 0, fontFamily: font, color: "#0f172a" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
          <Text style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>JobAlert</Text>
          <Text style={{ fontSize: 13, color: "#64748b", margin: "2px 0 24px" }}>Job Alert · {ruleName}</Text>
          <Text style={{ fontSize: 15, margin: "0 0 16px" }}>
            Hi {name}, here are {totalMatches} new jobs matching your preferences.
          </Text>
          {shown.map((job) => (
            <Section key={job.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{job.title}</Text>
              <Text style={{ fontSize: 13, color: "#64748b", margin: "4px 0 10px" }}>
                {job.company}
                {job.location ? ` · ${job.location}` : ""}
              </Text>
              <Text style={{ display: "inline-block", fontSize: 11, backgroundColor: "#f1f5f9", color: "#334155", borderRadius: 999, padding: "3px 10px", margin: "0 0 12px" }}>
                {job.source}
              </Text>
              <Button href={job.url} style={{ display: "block", width: "fit-content", backgroundColor: "#2563eb", color: "#ffffff", fontSize: 13, fontWeight: 600, borderRadius: 8, padding: "8px 16px", textDecoration: "none" }}>
                Apply
              </Button>
            </Section>
          ))}
          <Text style={{ margin: "16px 0" }}>
            <Link href={viewAllUrl} style={{ color: "#2563eb", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              View all matches →
            </Link>
          </Text>
          <Hr style={{ borderColor: "#f1f5f9", margin: "24px 0 12px" }} />
          <Text style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
            You get this because of the alert "{ruleName}". <Link href={manageUrl} style={{ color: "#64748b" }}>Manage alerts</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
