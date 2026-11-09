import { queryOne } from "@/lib/db";

export async function getOwner(): Promise<{ name: string; email: string }> {
  try {
    const row = await queryOne<{ owner_name: string; owner_email: string }>("SELECT owner_name, owner_email FROM settings WHERE id = 1");
    if (row) return { name: row.owner_name, email: row.owner_email };
  } catch {
    /* fall back to env */
  }
  return { name: process.env.OWNER_NAME || "there", email: process.env.OWNER_EMAIL || "" };
}
