import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

// Neon's serverless driver uses HTTP, avoiding TCP cold-start overhead in production.
// Self-hosted Postgres needs the standard pg adapter: DATABASE_DRIVER=pg (or any
// non-Neon URL) selects it; the hosted cloud keeps Neon.
const useNeon =
  process.env.DATABASE_DRIVER === "neon" ||
  (process.env.DATABASE_DRIVER !== "pg" &&
    process.env.NODE_ENV === "production" &&
    connectionString.includes("neon.tech"));
const adapter = useNeon
  ? new PrismaNeon({ connectionString })
  : new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

export { prisma };
