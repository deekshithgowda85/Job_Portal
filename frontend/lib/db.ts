import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

/** Parameterized query. Always pass user input through `params`, never string concatenation. */
export async function query<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await getClient().query(text, params as any[]);
  return rows as unknown as T[];
}

export async function queryOne<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
