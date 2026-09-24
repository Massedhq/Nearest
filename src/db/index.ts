import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// The placeholder only lets `next build` load this module; every real query needs DATABASE_URL.
const url = process.env.DATABASE_URL ?? "postgresql://missing:missing@localhost/missing";

export const db = drizzle({ client: neon(url), schema });
export * from "./schema";
