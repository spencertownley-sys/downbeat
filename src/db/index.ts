import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return postgres(url, {
    // Supabase pooled connections don't support prepared statements.
    prepare: false,
    max: 10,
    // postgres-js keeps idle connections open forever by default. Railway's
    // private network can drop an idle connection without telling either end,
    // and the next query on it hangs for a minute or more. Close connections
    // after 20s idle, recycle every connection after 5 minutes, and give up on
    // a connection attempt after 10s rather than 30s.
    idle_timeout: 20,
    max_lifetime: 5 * 60,
    connect_timeout: 10,
  });
}

// One pool per server process. The production build includes this module in
// several server chunks, and each would otherwise open its own pool; in
// development this also survives HMR reloads.
const client = globalThis.__pgClient ?? createClient();
globalThis.__pgClient = client;

export const db = drizzle(client, { schema });

export type Database = typeof db;
