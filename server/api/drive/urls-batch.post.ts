/** Presigned inline URL massal untuk thumbnail grid. */
export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const body = await readBody(event)
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 200) : []
  if (!ids.length) return { urls: {} }

  const client = driveMinio()
  const urls: Record<string, string> = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { file, access } = await fileAccess(session.user.id, id)
        if (!file || !access || file.isFolder || !file.objectKey) return
        const bucket = await bucketForFile(file)
        if (!bucket) return
        urls[id] = await client.presignedGetObject(bucket, file.objectKey, 3600, {
          'response-content-disposition': 'inline',
          'response-content-type': file.mimeType || 'application/octet-stream',
        })
      } catch {}
    }),
  )
  return { urls }
})
