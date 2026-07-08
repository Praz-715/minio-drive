import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const sharePermission = pgEnum('share_permission', ['viewer', 'editor'])

/**
 * File DAN folder dalam satu tabel (tree lewat parentId, null = root user).
 * objectKey MinIO dibuat immutable (`users/{ownerId}/{id}`) — rename/move
 * cukup update baris ini, objek di storage tidak pernah disentuh.
 * Trash = soft delete via deletedAt.
 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => files.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isFolder: boolean('is_folder').notNull().default(false),
    // null = item di Drive pribadi (bucket pemilik); terisi = item di bucket bersama
    teamBucketId: uuid('team_bucket_id'),
    objectKey: text('object_key'), // null untuk folder
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    mimeType: text('mime_type'),
    starred: boolean('starred').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }), // null = aktif, terisi = di trash
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('files_owner_parent_idx').on(t.ownerId, t.parentId),
    index('files_parent_id_idx').on(t.parentId),
    index('files_owner_deleted_idx').on(t.ownerId, t.deletedAt),
    index('files_team_bucket_idx').on(t.teamBucketId, t.parentId),
  ],
)

/** Share ke user lain (fitur yang tidak mungkin dilakukan IAM MinIO). */
export const fileShares = pgTable(
  'file_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    sharedWithId: text('shared_with_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sharedById: text('shared_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: sharePermission('permission').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('file_shares_file_user_uq').on(t.fileId, t.sharedWithId),
    index('file_shares_shared_with_idx').on(t.sharedWithId),
    index('file_shares_file_id_idx').on(t.fileId),
  ],
)

/** Link publik ber-token: expiry opsional, password opsional, hitungan download. */
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    permission: sharePermission('permission').notNull().default('viewer'),
    password: text('password'), // hash, null = tanpa password
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = selamanya
    downloads: integer('downloads').notNull().default(0),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('share_links_file_id_idx').on(t.fileId)],
)

// ---------- relations (buat query API db.query.* tanpa N+1) ----------

export const userRelations = relations(user, ({ many }) => ({
  files: many(files),
  sharedWithMe: many(fileShares),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(user, { fields: [files.ownerId], references: [user.id] }),
  parent: one(files, { fields: [files.parentId], references: [files.id], relationName: 'tree' }),
  children: many(files, { relationName: 'tree' }),
  shares: many(fileShares),
  links: many(shareLinks),
}))

export const fileSharesRelations = relations(fileShares, ({ one }) => ({
  file: one(files, { fields: [fileShares.fileId], references: [files.id] }),
  sharedWith: one(user, { fields: [fileShares.sharedWithId], references: [user.id] }),
  sharedBy: one(user, { fields: [fileShares.sharedById], references: [user.id] }),
}))

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  file: one(files, { fields: [shareLinks.fileId], references: [files.id] }),
  createdBy: one(user, { fields: [shareLinks.createdById], references: [user.id] }),
}))
