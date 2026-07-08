export default defineEventHandler(async (event) => {
  const name = decodeURIComponent(getRouterParam(event, 'name')!)
  await mc(event, ['admin', 'policy', 'rm', 'srv', name])
  return { ok: true }
})
