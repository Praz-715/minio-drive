import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { sharePermission } from './files'

/** Bucket bersama (MinIO bucket asli, dibuat admin, hard quota sendiri). */
export const teamBuckets = pgTable('team_buckets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  bucket: text('bucket').notNull().unique(), // nama bucket MinIO (team-xxxx)
  quota: bigint('quota', { mode: 'number' }).notNull().default(10 * 1024 ** 3),
  createdById: text('created_by_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Siapa saja yang di-assign ke bucket bersama + izinnya. */
export const teamBucketMembers = pgTable(
  'team_bucket_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bucketId: uuid('bucket_id')
      .notNull()
      .references(() => teamBuckets.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: sharePermission('permission').notNull().default('editor'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('team_members_bucket_user_uq').on(t.bucketId, t.userId),
    index('team_members_user_idx').on(t.userId),
    index('team_members_bucket_idx').on(t.bucketId),
  ],
)
