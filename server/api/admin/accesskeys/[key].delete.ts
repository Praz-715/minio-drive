export default defineEventHandler(async (event) => {
  const key = decodeURIComponent(getRouterParam(event, 'key')!)
  await mc(event, ['admin', 'accesskey', 'rm', 'srv', key])
  return { ok: true }
})
