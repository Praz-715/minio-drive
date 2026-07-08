import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const name = String(body?.name || '').trim()
  if (!/^[\w.-]{1,128}$/.test(name)) {
    throw createError({ statusCode: 400, message: 'Nama policy tidak valid (huruf/angka/._- maks 128)' })
  }

  let doc: any = body?.policy
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc)
    } catch {
      throw createError({ statusCode: 400, message: 'Policy bukan JSON yang valid' })
    }
  }
  if (!doc?.Statement) throw createError({ statusCode: 400, message: 'Policy harus punya field Statement' })

  // mc admin policy create butuh file, jadi tulis sementara lalu hapus
  const tmpFile = join(tmpdir(), `yasa-policy-${randomUUID()}.json`)
  await writeFile(tmpFile, JSON.stringify(doc, null, 2), 'utf-8')
  try {
    await mc(event, ['admin', 'policy', 'create', 'srv', name, tmpFile])
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
  return { ok: true, name }
})
