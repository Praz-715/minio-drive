export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const policy = String(body?.policy || '').trim()
  const user = String(body?.user || '').trim()
  const detach = Boolean(body?.detach)
  if (!policy || !user) throw createError({ statusCode: 400, message: 'Policy dan user wajib diisi' })

  await mc(event, ['admin', 'policy', detach ? 'detach' : 'attach', 'srv', policy, '--user', user])
  return { ok: true }
})
