import { eq, sql } from 'drizzle-orm'
import { files, user } from '../../db/schema'

/** Bersihkan nama file dari path separator & karakter kontrol. */
function cleanName(name: string): string {
  const n = String(name || '')
    .replace(/[/\\]/g, '-')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
  return n || 'file'
}

/**
 * Upload kontekstual. Lokasi ditentukan `parent` (folder) atau `team` (root
 * bucket bersama); kosong = root Drive pribadi. Objek disimpan di bucket
 * tujuan (pribadi atau tim), kuota dikurangi dari pemilik ruang yang sesuai.
 * Item baru mengikuti pemilik ruang tujuan (loc.ownerId) — bukan pengupload —
 * biar objek, kuota, dan bucketForFile() selalu sinkron.
 */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const db = useDriveDb()

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, message: 'Tidak ada file' })
  const field = (n: string) => parts.find((p) => p.name === n && !p.filename)?.data.toString('utf-8') || ''

  const loc = await resolveWriteLocation(me, { parent: field('parent'), team: field('team') })
  const fileParts = parts.filter((p) => p.filename)
  if (!fileParts.length) throw createError({ statusCode: 400, message: 'Tidak ada file' })
  const totalSize = fileParts.reduce((a, p) => a + p.data.length, 0)

  // cek kuota ruang tujuan (hanya ruang pribadi yang punya counter DB)
  if (loc.quotaTarget === 'user') {
    const [u] = await db.select().from(user).where(eq(user.id, loc.quotaId)).limit(1)
    if (u!.storageUsed + totalSize > u!.storageQuota) {
      throw createError({ statusCode: 400, message: `Kuota tidak cukup — sisa ${fmtSisa(u!.storageQuota - u!.storageUsed)}` })
    }
  }
  // (bucket tim: hard-quota MinIO jadi pagar; tidak ada counter agregat di DB)

  const client = driveMinio()
  let uploaded = 0
  for (const part of fileParts) {
    const [row] = await db
      .insert(files)
      .values({
        ownerId: loc.ownerId,
        parentId: loc.parentId,
        teamBucketId: loc.teamBucketId,
        name: cleanName(part.filename!),
        isFolder: false,
        size: part.data.length,
        mimeType: part.type || 'application/octet-stream',
      })
      .returning()
    const objectKey = `f/${row!.id}`
    try {
      await client.putObject(loc.bucket, objectKey, part.data, part.data.length, {
        'Content-Type': part.type || 'application/octet-stream',
      })
    } catch (e: any) {
      await db.delete(files).where(eq(files.id, row!.id))
      throw createError({ statusCode: 500, message: `Upload "${cleanName(part.filename!)}" gagal` })
    }
    await db.update(files).set({ objectKey }).where(eq(files.id, row!.id))
    // hitung kuota PER FILE yang benar-benar tersimpan (anti-drift saat gagal di tengah)
    if (loc.quotaTarget === 'user') {
      await db
        .update(user)
        .set({ storageUsed: sql`${user.storageUsed} + ${part.data.length}`, updatedAt: new Date() })
        .where(eq(user.id, loc.quotaId))
    }
    uploaded++
  }

  return { ok: true, uploaded }
})

function fmtSisa(n: number) {
  if (n <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3)
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}
