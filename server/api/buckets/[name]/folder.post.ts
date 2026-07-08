export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const body = await readBody(event)
  const prefix = String(body?.prefix || '')
  const name = String(body?.name || '').trim().replace(/^\/+|\/+$/g, '')
  if (!name) throw createError({ statusCode: 400, message: 'Nama folder wajib diisi' })

  const client = await getMinio(event)
  try {
    await client.putObject(bucket, `${prefix}${name}/`, Buffer.alloc(0), 0)
    return { ok: true }
  } catch (e: any) {
    throw s3Error(e)
  }
})
