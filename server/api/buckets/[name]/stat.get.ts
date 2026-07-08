export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')!
  const client = await getMinio(event)

  let creationDate: Date | null = null
  try {
    const buckets = await client.listBuckets()
    creationDate = buckets.find((b) => b.name === name)?.creationDate ?? null
  } catch {}

  // level akses anonymous: private | download | upload | public (fallback 'custom' kalau ada policy manual)
  let access = 'private'
  try {
    const [line] = await mc(event, ['anonymous', 'get', `srv/${name}`])
    access = line?.permission || 'private'
  } catch {
    try {
      await client.getBucketPolicy(name)
      access = 'custom'
    } catch {}
  }

  let versioning = false
  try {
    const v: any = await client.getBucketVersioning(name)
    versioning = v?.Status === 'Enabled'
  } catch {}

  // ukuran & jumlah objek dari metrics prometheus (butuh hak admin — null kalau bukan)
  let size: number | null = null
  let objects: number | null = null
  try {
    const text = await mcRaw(event, ['admin', 'prometheus', 'metrics', 'srv', 'bucket'])
    const sizes = parseProm(text, 'minio_bucket_usage_total_bytes', 'bucket')
    const counts = parseProm(text, 'minio_bucket_usage_object_total', 'bucket')
    size = sizes[name] ?? 0
    objects = counts[name] ?? 0
  } catch {}

  return { name, creationDate, access, versioning, size, objects }
})
