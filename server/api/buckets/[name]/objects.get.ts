const MAX_KEYS = 1000

export default defineEventHandler(async (event) => {
  const bucket = getRouterParam(event, 'name')!
  const prefix = String(getQuery(event).prefix || '')
  const client = await getMinio(event)

  return await new Promise((resolve, reject) => {
    const objects: any[] = []
    const prefixes: string[] = []
    let truncated = false

    const stream = client.listObjectsV2(bucket, prefix, false)
    stream.on('data', (item: any) => {
      if (item.prefix) {
        prefixes.push(item.prefix)
      } else if (item.name) {
        // skip marker "folder" object milik prefix itu sendiri
        if (item.name === prefix && item.size === 0) return
        objects.push({
          name: item.name,
          size: item.size,
          lastModified: item.lastModified,
          etag: item.etag,
        })
      }
      if (objects.length + prefixes.length >= MAX_KEYS) {
        truncated = true
        stream.destroy()
        resolve({ objects, prefixes, truncated })
      }
    })
    stream.on('error', (e: any) => reject(s3Error(e)))
    stream.on('end', () => resolve({ objects, prefixes, truncated }))
  })
})
