const LEVELS = new Set(['private', 'download', 'upload', 'public'])

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')!
  const body = await readBody(event)
  const level = String(body?.level || '')
  if (!LEVELS.has(level)) {
    throw createError({ statusCode: 400, message: 'Level akses tidak valid (private/download/upload/public)' })
  }
  // 'none' = hapus anonymous policy alias private
  await mc(event, ['anonymous', 'set', level === 'private' ? 'none' : level, `srv/${name}`])
  return { ok: true, level }
})
