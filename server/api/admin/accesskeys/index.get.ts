function normalizeEntry(e: any) {
  return {
    accessKey: e.accessKey || e.AccessKey || '',
    parentUser: e.parentUser || e.ParentUser || '',
    status: e.accountStatus || e.status || e.AccountStatus || 'on',
    name: e.name || e.Name || '',
    expiration: e.expiration || e.Expiration || null,
  }
}

export default defineEventHandler(async (event) => {
  const user = String(getQuery(event).user || '').trim()
  if (!user) throw createError({ statusCode: 400, message: 'Parameter user wajib diisi' })

  const lines = await mc(event, ['admin', 'accesskey', 'ls', 'srv', user])

  // output mc bervariasi antar versi: bisa satu objek berisi array, bisa per baris
  const entries: any[] = []
  for (const l of lines) {
    if (Array.isArray(l.svcaccs)) entries.push(...l.svcaccs)
    else if (Array.isArray(l.accessKeys)) entries.push(...l.accessKeys)
    else if (Array.isArray(l.serviceAccounts)) entries.push(...l.serviceAccounts)
    else if (l.accessKey && l.status !== 'error') entries.push(l)
  }
  return entries.map(normalizeEntry).filter((e) => e.accessKey && e.accessKey !== user)
})
