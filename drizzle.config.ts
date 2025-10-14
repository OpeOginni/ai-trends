import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

 
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/drizzle",
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  }
});
