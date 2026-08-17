import type { Config } from 'drizzle-kit'

// drizzle-kit generates SQL files into ./migrations from the schema.
// The custom runner in scripts/migrate.ts applies those SQL files.
// These two are complementary: drizzle-kit for generation, migrate.ts for execution.
export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
