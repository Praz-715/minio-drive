export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, message: 'Tidak ada file yang diupload' })

  const client = await getMinio(event)
  const prefixPart = parts.find((p) => p.name === 'prefix' && !p.filename)
  const prefix = prefixPart ? prefixPart.data.toString('utf-8') : ''

  const uploaded: string[] = []
  try {
    for (const part of parts) {
      if (!part.filename) continue
      const key = prefix + part.filename
      await client.putObject(bucket, key, part.data, part.data.length, {
        'Content-Type': part.type || 'application/octet-stream',
      })
      uploaded.push(key)
    }
  } catch (e: any) {
    throw s3Error(e)
  }

  if (!uploaded.length) throw createError({ statusCode: 400, message: 'Tidak ada file yang diupload' })
  return { ok: true, uploaded }
})
