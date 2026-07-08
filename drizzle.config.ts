import { defineConfig } from 'drizzle-kit'

// Node 20.12+ — load .env tanpa dependency dotenv
process.loadEnvFile?.('.env')

export default defineConfig({
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
