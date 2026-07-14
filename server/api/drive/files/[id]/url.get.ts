const MAX_EXPIRY = 7 * 24 * 3600

/** Presigned URL file (viewer+): buat preview, download, dan link berbagi cepat. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const id = getRouterParam(event, 'id')!
  const q = getQuery(event)

  const { file } = await requireFileAccess(session.user.id, id, 'viewer')
  if (file.isFolder || !file.objectKey) throw createError({ statusCode: 400, message: 'Bukan file' })
  // file di sampah tidak boleh diunduh walau baris share-nya masih ada
  if (file.deletedAt) throw createError({ statusCode: 404, message: 'File ada di sampah' })

  const bucket = await bucketForFile(file)
  if (!bucket) throw createError({ statusCode: 500, message: 'Bucket tidak ditemukan' })

  const expiry = Math.min(Math.max(Math.floor(Number(q.expiry) || 3600), 60), MAX_EXPIRY)
  const url = await driveMinio().presignedGetObject(bucket, file.objectKey, expiry, {
    'response-content-disposition': q.inline ? 'inline' : `attachment; filename="${file.name}"`,
    'response-content-type': file.mimeType || 'application/octet-stream',
  })
  return { url, expiry, name: file.name }
})
