import type { MinioCreds } from './creds'

/** Cek apakah kredensial punya hak admin, plus alasan kalau tidak. */
export async function detectAdmin(creds: MinioCreds): Promise<{ admin: boolean; reason?: string }> {
  try {
    await mcWithCreds(creds, ['admin', 'info', 'srv'])
    return { admin: true }
  } catch (e: any) {
    const reason = e?.message || String(e)
    console.warn(`[yasa] admin check gagal untuk "${creds.accessKey}": ${reason}`)
    return { admin: false, reason }
  }
}
