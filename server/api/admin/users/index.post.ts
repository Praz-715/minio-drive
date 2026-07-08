export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const accessKey = String(body?.accessKey || '').trim()
  const secretKey = String(body?.secretKey || '')
  const policy = String(body?.policy || '').trim()

  if (accessKey.length < 3) throw createError({ statusCode: 400, message: 'Access key minimal 3 karakter' })
  if (secretKey.length < 8) throw createError({ statusCode: 400, message: 'Secret key minimal 8 karakter' })

  await mc(event, ['admin', 'user', 'add', 'srv', accessKey, secretKey])

  let policyWarning = ''
  if (policy) {
    try {
      await mc(event, ['admin', 'policy', 'attach', 'srv', policy, '--user', accessKey])
    } catch (e: any) {
      policyWarning = `User dibuat, tapi gagal attach policy: ${e?.message || e}`
    }
  }
  return { ok: true, accessKey, policyWarning }
})
