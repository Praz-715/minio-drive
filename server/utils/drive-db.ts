import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

/**
 * Koneksi database Drive (postgres.js + Drizzle).
 * Di-cache di globalThis supaya hot-reload dev tidak membuka koneksi baru terus.
 */

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw createError({ statusCode: 500, message: 'DATABASE_URL belum di-set di .env' })
  }
  const client = postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  })
  return drizzle(client, { schema })
}

type DriveDb = ReturnType<typeof createDb>

const globalForDb = globalThis as unknown as { __driveDb?: DriveDb }

export function useDriveDb(): DriveDb {
  if (!globalForDb.__driveDb) {
    globalForDb.__driveDb = createDb()
  }
  return globalForDb.__driveDb
}
