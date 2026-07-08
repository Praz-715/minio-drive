import { files } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireDriveSession(event)
  const me = session.user.id
  const body = await readBody(event)

  const name = String(body?.name || '').trim().replace(/[/\\]/g, '-')
  if (!name) throw createError({ statusCode: 400, message: 'Nama folder wajib diisi' })

  const loc = await resolveWriteLocation(me, { parent: String(body?.parent || ''), team: String(body?.team || '') })

  const db = useDriveDb()
  const [row] = await db
    .insert(files)
    .values({ ownerId: loc.ownerId, parentId: loc.parentId, teamBucketId: loc.teamBucketId, name, isFolder: true })
    .returning()

  return { ok: true, id: row!.id }
})
