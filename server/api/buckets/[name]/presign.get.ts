// batas protokol S3 signature v4: presigned URL maksimal 7 hari
const MAX_EXPIRY = 7 * 24 * 3600

export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const q = getQuery(event)
  const key = String(q.key || '')
  if (!key) throw createError({ statusCode: 400, message: 'Parameter key wajib diisi' })

  const expiry = Math.min(Math.max(Math.floor(Number(q.expiry) || 3600), 60), MAX_EXPIRY)

  const client = await getMinio(event)
  const filename = key.split('/').pop() || 'download'
  try {
    const url = await client.presignedGetObject(bucket, key, expiry, {
      'response-content-disposition': q.inline ? 'inline' : `attachment; filename="${filename}"`,
    })
    return { url, expiry }
  } catch (e: any) {
    throw s3Error(e)
  }
})
