export default defineEventHandler(async (event) => {
  const key = decodeURIComponent(getRouterParam(event, 'key')!)
  await mc(event, ['admin', 'user', 'rm', 'srv', key])
  return { ok: true }
})
