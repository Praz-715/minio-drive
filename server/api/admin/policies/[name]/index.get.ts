export default defineEventHandler(async (event) => {
  const name = decodeURIComponent(getRouterParam(event, 'name')!)
  const lines = await mc(event, ['admin', 'policy', 'info', 'srv', name])
  const line = lines[0] || {}
  // bentuk output mc beda-beda antar versi — coba beberapa kemungkinan
  const doc = line.policyJSON || line.policyInfo?.Policy || line.Policy || line.policy_json || null
  return { name, doc, raw: doc ? undefined : line }
})
