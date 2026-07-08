export default defineEventHandler(async (event) => {
  const creds = await requireCreds(event)
  const { admin, reason } = await detectAdmin(creds)
  await setUserSession(event, { user: { accessKey: creds.accessKey, admin } })
  return { admin, reason }
})
