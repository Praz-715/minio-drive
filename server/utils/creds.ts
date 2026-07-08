import type { H3Event } from 'h3'

export interface MinioCreds {
  accessKey: string
  secretKey: string
}

export async function requireCreds(event: H3Event): Promise<MinioCreds> {
  const session = await requireUserSession(event)
  const accessKey = (session.user as any)?.accessKey
  const secretKey = (session.secure as any)?.secretKey
  if (!accessKey || !secretKey) {
    throw createError({ statusCode: 401, message: 'Sesi tidak valid, silakan login ulang' })
  }
  return { accessKey, secretKey }
}

export async function isAdminSession(event: H3Event): Promise<boolean> {
  const session = await getUserSession(event)
  return Boolean((session.user as any)?.admin)
}
