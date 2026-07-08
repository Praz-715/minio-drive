export default defineEventHandler(async (event) => {
  const client = await getMinio(event)
  try {
    const buckets = await client.listBuckets()
    return buckets.map((b) => ({ name: b.name, creationDate: b.creationDate }))
  } catch (e: any) {
    throw s3Error(e)
  }
})
