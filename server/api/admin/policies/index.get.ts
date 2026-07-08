export default defineEventHandler(async (event) => {
  const lines = await mc(event, ['admin', 'policy', 'ls', 'srv'])
  return lines
    .filter((l) => l.policy)
    .map((l) => ({ name: l.policy }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
