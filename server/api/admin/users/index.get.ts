export default defineEventHandler(async (event) => {
  const lines = await mc(event, ['admin', 'user', 'ls', 'srv'])
  return lines
    .filter((l) => l.accessKey)
    .map((l) => ({
      accessKey: l.accessKey,
      status: l.userStatus || 'enabled',
      policy: l.policyName || '',
    }))
})
