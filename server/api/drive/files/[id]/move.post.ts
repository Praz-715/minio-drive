import { eq, inArray, sql } from 'drizzle-orm'
import { files, teamBuckets, user } from '../../../../db/schema'

const MAX_NODES = 5000

/**
 * Pindahkan file/folder ke tujuan mana pun: Drive pribadi ATAU bucket bersama.
 * Body { parent?, team? } sama seperti upload (resolveWriteLocation).
 *
 * - Dalam bucket yang sama (pribadi→pribadi / tim→tim yang sama): cukup ubah parentId.
 * - Lintas bucket (pribadi↔tim / tim A↔tim B): objek MinIO seluruh subtree
 *   disalin ke bucket tujuan lalu dihapus dari sumber, teamBucketId subtree
 *   diperbarui, dan kuota pribadi disesuaikan.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const db = useDriveDb()

  // hanya owner item (uploader/admin utk tim, pemilik utk pribadi) yang boleh memindah
  const { file: root } = await requireFileAccess(me, id, 'owner')
  if (root.deletedAt) throw createError({ statusCode: 400, message: 'Item ada di sampah' })

  // tujuan (cek izin tulis dilakukan di resolveWriteLocation)
  const loc = await resolveWriteLocation(me, {
    parent: String(body?.parent || ''),
    team: String(body?.team || ''),
  })
  const dstTeam = loc.teamBucketId || null
  const srcTeam = root.teamBucketId || null

  // guard: tak boleh masuk ke diri sendiri / turunannya
  if (loc.parentId === id) throw createError({ statusCode: 400, message: 'Tidak bisa pindah ke dalam dirinya sendiri' })
  if (root.isFolder && loc.parentId) {
    let cur: any = (await db.select().from(files).where(eq(files.id, loc.parentId)).limit(1))[0]
    for (let i = 0; i < 64 && cur; i++) {
      if (cur.id === id) throw createError({ statusCode: 400, message: 'Tidak bisa pindah ke dalam folder itu sendiri' })
      if (!cur.parentId) break
      cur = (await db.select().from(files).where(eq(files.id, cur.parentId)).limit(1))[0]
    }
  }

  // ---- jalur cepat: bucket sama, cuma pindah folder ----
  if (srcTeam === dstTeam) {
    if ((root.parentId || null) === (loc.parentId || null)) return { ok: true, moved: 0, unchanged: true }
    await db.update(files).set({ parentId: loc.parentId, updatedAt: new Date() }).where(eq(files.id, id))
    return { ok: true, moved: 1 }
  }

  // ---- jalur lintas-bucket ----
  // kumpulkan seluruh subtree (item + turunan aktif)
  // sertakan turunan yang di-trash juga: objek & teamBucketId mereka harus ikut
  // pindah, kalau tidak bucketForFile() akan menunjuk bucket yang salah.
  const all: any[] = [root]
  let frontier = [id]
  while (frontier.length) {
    const kids = await db.select().from(files).where(inArray(files.parentId, frontier))
    all.push(...kids)
    frontier = kids.map((k) => k.id)
    if (all.length > MAX_NODES) throw createError({ statusCode: 400, message: 'Folder terlalu besar untuk dipindah sekaligus' })
  }
  const allIds = all.map((f) => f.id)
  const objFiles = all.filter((f) => !f.isFolder && f.objectKey)
  const totalSize = objFiles.reduce((a, f) => a + (f.size || 0), 0)

  // ke Drive pribadi: hanya boleh untuk item milik sendiri (model bucket-per-pemilik)
  if (!dstTeam && !all.every((f) => f.ownerId === me)) {
    throw createError({
      statusCode: 400,
      message: 'Ada item milik user lain di dalamnya — tidak bisa dipindah ke Drive pribadi',
    })
  }

  // resolusi bucket sumber & tujuan per file
  const owners = await ownerMap(all.map((f) => f.ownerId))
  const srcTeamBucket = srcTeam
    ? (await db.select({ b: teamBuckets.bucket }).from(teamBuckets).where(eq(teamBuckets.id, srcTeam)).limit(1))[0]?.b
    : null
  const bucketOf = (f: any, team: string | null): string | null => {
    if (team) return team === dstTeam ? loc.bucket : (srcTeamBucket as string)
    return owners[f.ownerId]?.bucket || null
  }

  // cek kuota kalau masuk ke Drive pribadi
  if (!dstTeam) {
    const [u] = await db.select().from(user).where(eq(user.id, me)).limit(1)
    if (u && u.storageUsed + totalSize > u.storageQuota) {
      throw createError({ statusCode: 400, message: 'Kuota Drive pribadi tidak cukup untuk memindahkan ini' })
    }
  }

  // 1) salin semua objek ke bucket tujuan (kalau salah satu gagal → rollback salinan)
  const client = driveMinio()
  const copied: { bucket: string; key: string }[] = []
  try {
    for (const f of objFiles) {
      const src = bucketOf(f, srcTeam)
      const dst = bucketOf(f, dstTeam)
      if (!src || !dst || src === dst) continue
      await client.copyObject(dst, f.objectKey, `/${src}/${f.objectKey}`)
      copied.push({ bucket: dst, key: f.objectKey })
    }
  } catch (e: any) {
    for (const c of copied) {
      try {
        await client.removeObject(c.bucket, c.key)
      } catch {}
    }
    throw createError({ statusCode: 500, message: `Gagal memindahkan objek: ${e?.message || e}` })
  }

  // 2) update DB: teamBucketId seluruh subtree + parentId root
  await db.update(files).set({ teamBucketId: dstTeam }).where(inArray(files.id, allIds))
  await db.update(files).set({ parentId: loc.parentId, updatedAt: new Date() }).where(eq(files.id, id))

  // 3) hapus objek di bucket sumber
  for (const f of objFiles) {
    const src = bucketOf(f, srcTeam)
    const dst = bucketOf(f, dstTeam)
    if (!src || !dst || src === dst) continue
    try {
      await client.removeObject(src, f.objectKey)
    } catch {}
  }

  // 4) sesuaikan kuota pribadi
  if (srcTeam && !dstTeam) {
    // tim → pribadi: pemakaian pemilik bertambah (semua = me karena aturan di atas)
    await db.update(user).set({ storageUsed: sql`${user.storageUsed} + ${totalSize}`, updatedAt: new Date() }).where(eq(user.id, me))
  } else if (!srcTeam && dstTeam) {
    // pribadi → tim: pemakaian pemilik berkurang (per pemilik biar aman)
    const byOwner: Record<string, number> = {}
    for (const f of objFiles) byOwner[f.ownerId] = (byOwner[f.ownerId] || 0) + (f.size || 0)
    for (const [ownerId, size] of Object.entries(byOwner)) {
      await db
        .update(user)
        .set({ storageUsed: sql`GREATEST(0, ${user.storageUsed} - ${size})`, updatedAt: new Date() })
        .where(eq(user.id, ownerId))
    }
  }

  return { ok: true, moved: 1, crossBucket: true, files: objFiles.length }
})
