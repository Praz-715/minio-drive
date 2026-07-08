import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { files, teamBuckets, user } from '../../../../db/schema'

const MAX_NODES = 5000

/** Pisah nama jadi base + ekstensi (ekstensi hanya kalau titik bukan di awal). */
function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot > 0) return { base: name.slice(0, dot), ext: name.slice(dot) }
  return { base: name, ext: '' }
}

/**
 * Gandakan file/folder di lokasi yang sama. Objek MinIO ikut disalin
 * (key baru per baris). Salinan dimiliki oleh yang menyalin; nama diberi
 * sufiks " salinan{N}" yang unik di antara sibling.
 * - pribadi: hanya pemilik; salinan masuk bucket pribadi + kuota bertambah.
 * - tim: butuh editor; salinan tetap di bucket tim (kuota hard MinIO).
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const db = useDriveDb()

  const { file: orig, access } = await requireFileAccess(me, id, 'viewer')
  if (orig.deletedAt) throw createError({ statusCode: 400, message: 'Item ada di sampah' })

  const inTeam = !!orig.teamBucketId
  if (inTeam) {
    if (access !== 'owner' && access !== 'editor') {
      throw createError({ statusCode: 403, message: 'Butuh akses editor untuk menyalin di bucket bersama' })
    }
  } else if (orig.ownerId !== me) {
    throw createError({ statusCode: 403, message: 'Hanya pemilik yang bisa menyalin item ini' })
  }

  // nama salinan unik di antara sibling (parent & bucket yang sama, belum di-trash)
  const { base, ext } = splitName(orig.name)
  const siblings = await db
    .select({ name: files.name })
    .from(files)
    .where(
      and(
        orig.parentId ? eq(files.parentId, orig.parentId) : isNull(files.parentId),
        orig.teamBucketId ? eq(files.teamBucketId, orig.teamBucketId) : isNull(files.teamBucketId),
        isNull(files.deletedAt),
      ),
    )
  const taken = new Set(siblings.map((s) => s.name))
  let n = 1
  let copyName = `${base} salinan${n}${ext}`
  while (taken.has(copyName)) copyName = `${base} salinan${++n}${ext}`

  // kumpulkan subtree (item + turunan aktif)
  const all: any[] = [orig]
  let frontier = [id]
  while (frontier.length) {
    const kids = await db.select().from(files).where(inArray(files.parentId, frontier))
    const live = kids.filter((k) => !k.deletedAt)
    all.push(...live)
    frontier = live.map((k) => k.id)
    if (all.length > MAX_NODES) throw createError({ statusCode: 400, message: 'Folder terlalu besar untuk disalin sekaligus' })
  }
  const objFiles = all.filter((f) => !f.isFolder && f.objectKey)
  const totalSize = objFiles.reduce((a, f) => a + (f.size || 0), 0)

  // bucket tujuan
  let destBucket: string
  if (inTeam) {
    const [tb] = await db.select().from(teamBuckets).where(eq(teamBuckets.id, orig.teamBucketId)).limit(1)
    if (!tb) throw createError({ statusCode: 404, message: 'Bucket bersama tidak ditemukan' })
    destBucket = tb.bucket
  } else {
    destBucket = await ensureUserBucket(me)
  }

  // cek kuota (hanya pribadi yang pakai counter DB)
  if (!inTeam) {
    const [u] = await db.select().from(user).where(eq(user.id, me)).limit(1)
    if (u && u.storageUsed + totalSize > u.storageQuota) {
      throw createError({ statusCode: 400, message: 'Kuota tidak cukup untuk membuat salinan' })
    }
  }

  // buat baris baru (mapping id lama→baru), lalu salin objek
  const idMap: Record<string, string> = {}
  const client = driveMinio()
  const createdRows: string[] = []
  const copiedObjs: { bucket: string; key: string }[] = []

  try {
    for (const f of all) {
      const isRoot = f.id === id
      const newParent = isRoot ? orig.parentId : idMap[f.parentId!]
      const [row] = await db
        .insert(files)
        .values({
          ownerId: me,
          parentId: newParent ?? null,
          teamBucketId: orig.teamBucketId ?? null,
          name: isRoot ? copyName : f.name,
          isFolder: f.isFolder,
          size: f.size,
          mimeType: f.mimeType,
          starred: false,
        })
        .returning({ id: files.id })
      idMap[f.id] = row!.id
      createdRows.push(row!.id)
    }

    for (const f of objFiles) {
      const srcBucket = await bucketForFile(f)
      if (!srcBucket) continue
      const newKey = `f/${idMap[f.id]}`
      await client.copyObject(destBucket, newKey, `/${srcBucket}/${f.objectKey}`)
      copiedObjs.push({ bucket: destBucket, key: newKey })
      await db.update(files).set({ objectKey: newKey }).where(eq(files.id, idMap[f.id]!))
    }
  } catch (e: any) {
    for (const c of copiedObjs) {
      try {
        await client.removeObject(c.bucket, c.key)
      } catch {}
    }
    if (createdRows.length) await db.delete(files).where(inArray(files.id, createdRows))
    throw createError({ statusCode: 500, message: `Gagal membuat salinan: ${e?.message || e}` })
  }

  if (!inTeam && totalSize > 0) {
    await db
      .update(user)
      .set({ storageUsed: sql`${user.storageUsed} + ${totalSize}`, updatedAt: new Date() })
      .where(eq(user.id, me))
  }

  return { ok: true, name: copyName, id: idMap[id], files: objFiles.length }
})
