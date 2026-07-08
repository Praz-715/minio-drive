export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const accessKey = String(body?.accessKey || '').trim()
  const secretKey = String(body?.secretKey || '').trim()
  if (!accessKey || !secretKey) {
    throw createError({ statusCode: 400, message: 'Access key dan secret key wajib diisi' })
  }

  const creds = { accessKey, secretKey }
  const client = minioClientFor(creds)

  try {
    await client.listBuckets()
  } catch (e: any) {
    const code = e?.code || ''
    if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') {
      throw createError({ statusCode: 401, message: 'Kredensial salah' })
    }
    if (code !== 'AccessDenied') {
      throw createError({
        statusCode: 502,
        message: `Tidak bisa terhubung ke MinIO (${useRuntimeConfig().minioEndpoint}): ${e?.message || code}`,
      })
    }
    // AccessDenied = kredensial valid tapi tanpa izin ListAllMyBuckets — tetap boleh login
  }

  // deteksi hak admin (buat nampilin menu RBAC)
  const { admin, reason } = await detectAdmin(creds)

  await setUserSession(event, {
    user: { accessKey, admin },
    secure: { secretKey },
    loggedInAt: Date.now(),
  })

  return { ok: true, admin, adminReason: reason }
})
