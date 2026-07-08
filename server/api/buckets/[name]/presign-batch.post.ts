export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const body = await readBody(event)
  const keys: string[] = Array.isArray(body?.keys) ? body.keys.filter(Boolean).slice(0, 300) : []
  if (!keys.length) return { urls: {} }

  const expiry = Math.min(Math.max(Math.floor(Number(body?.expiry) || 3600), 60), 7 * 24 * 3600)
  const client = await getMinio(event)

  // presign itu komputasi HMAC lokal (tanpa round-trip ke MinIO), aman di-batch
  const urls: Record<string, string> = {}
  await Promise.all(
    keys.map(async (k) => {
      try {
        urls[k] = await client.presignedGetObject(bucket, k, expiry, {
          'response-content-disposition': 'inline',
        })
      } catch {}
    }),
  )
  return { urls }
})
