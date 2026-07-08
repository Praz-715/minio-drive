export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')!
  const body = await readBody(event)
  const client = await getMinio(event)
  try {
    await client.setBucketVersioning(name, { Status: body?.enabled ? 'Enabled' : 'Suspended' })
    return { ok: true, versioning: Boolean(body?.enabled) }
  } catch (e: any) {
    throw s3Error(e)
  }
})
