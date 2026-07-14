import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Pengaturan aplikasi global (satu baris, id = 'app'). Dipakai untuk branding
 * kustom: nama aplikasi & logo (data URI). null = pakai bawaan (Yasa Drive / "Y").
 */
export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey(), // selalu 'app'
  appName: text('app_name'), // null = default "YASA DRIVE"
  logo: text('logo'), // data URI gambar, null = default logo "Y"
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
