export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const user = String(body?.user || '').trim()
  if (!user) throw createError({ statusCode: 400, message: 'User wajib dipilih' })

  const args = ['admin', 'accesskey', 'create', 'srv', user]
  if (body?.name) args.push('--name', String(body.name))

  const lines = await mc(event, args)
  const line = lines.find((l) => l.accessKey || l.credentials) || {}
  const creds = line.credentials || line
  return {
    ok: true,
    accessKey: creds.accessKey || '',
    secretKey: creds.secretKey || '',
  }
})
