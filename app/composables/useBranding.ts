export interface Branding {
  appName: string | null
  hasLogo: boolean
  logoVersion: string | null // buat cache-busting URL /api/branding/logo
}

/** State branding global (di-hydrate dari server lewat plugin branding). */
export const useBranding = () =>
  useState<Branding>('branding', () => ({ appName: null, hasLogo: false, logoVersion: null }))
