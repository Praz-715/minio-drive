export interface Branding {
  appName: string | null
  logo: string | null
}

/** State branding global (di-hydrate dari server lewat plugin branding). */
export const useBranding = () => useState<Branding>('branding', () => ({ appName: null, logo: null }))
