export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')!
  const client = await getMinio(event)
  try {
    await client.removeBucket(name)
    return { ok: true }
  } catch (e: any) {
    if (e?.code === 'BucketNotEmpty') {
      throw createError({ statusCode: 409, message: 'Bucket masih berisi objek — kosongkan dulu sebelum dihapus' })
    }
    throw s3Error(e)
  }
})
