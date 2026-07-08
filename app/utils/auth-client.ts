import { createAuthClient } from 'better-auth/vue'

/** Client auth Drive — endpoint server di /api/drive-auth (bukan default /api/auth). */
export const authClient = createAuthClient({
  baseURL: import.meta.client ? `${window.location.origin}/api/drive-auth` : undefined,
})
