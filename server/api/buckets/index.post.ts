const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const QUOTA_RE = /^[0-9]+(\.[0-9]+)?\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)$/i

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const name = String(body?.name || '').trim()
  const versioning = Boolean(body?.versioning)
  const objectLocking = Boolean(body?.objectLocking)
  const quota = String(body?.quota || '').trim()
  const access = String(body?.access || 'private')

  if (!BUCKET_RE.test(name)) {
    throw createError({
      statusCode: 400,
      message: 'Nama bucket tidak valid (3-63 karakter: huruf kecil, angka, titik, strip)',
    })
  }
  if (quota && !QUOTA_RE.test(quota)) {
    throw createError({ statusCode: 400, message: 'Format quota tidak valid — contoh: 10GiB, 500MiB, 1TiB' })
  }

  const client = await getMinio(event)
  try {
    // object locking otomatis mengaktifkan versioning di sisi server
    await client.makeBucket(name, '', objectLocking ? { ObjectLocking: true } : undefined)
    if (versioning && !objectLocking) {
      await client.setBucketVersioning(name, { Status: 'Enabled' })
    }
  } catch (e: any) {
    throw s3Error(e)
  }

  const warnings: string[] = []
  if (quota) {
    try {
      await mc(event, ['quota', 'set', `srv/${name}`, '--size', quota.replace(/\s+/g, '')])
    } catch (e: any) {
      warnings.push(`quota gagal dipasang: ${e?.message || e}`)
    }
  }
  if (['download', 'upload', 'public'].includes(access)) {
    try {
      await mc(event, ['anonymous', 'set', access, `srv/${name}`])
    } catch (e: any) {
      warnings.push(`akses publik gagal dipasang: ${e?.message || e}`)
    }
  }

  return { ok: true, name, quotaWarning: warnings.join('; ') }
})
