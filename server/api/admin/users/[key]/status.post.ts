export default defineEventHandler(async (event) => {
  const key = decodeURIComponent(getRouterParam(event, 'key')!)
  const body = await readBody(event)
  const action = body?.enabled ? 'enable' : 'disable'
  await mc(event, ['admin', 'user', action, 'srv', key])
  return { ok: true }
})
