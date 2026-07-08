export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const body = await readBody(event)
  const keys: string[] = Array.isArray(body?.keys) ? body.keys.filter(Boolean) : []
  if (!keys.length) throw createError({ statusCode: 400, message: 'Tidak ada objek yang dipilih' })

  const client = await getMinio(event)
  try {
    await client.removeObjects(bucket, keys)
    return { ok: true, deleted: keys.length }
  } catch (e: any) {
    throw s3Error(e)
  }
})
