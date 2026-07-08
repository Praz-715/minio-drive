export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const config = useRuntimeConfig()
  return { endpoint: config.minioEndpoint }
})
