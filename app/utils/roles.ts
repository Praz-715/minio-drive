/** Helper role untuk sisi klien (auto-import di komponen Vue). */
export type Role = 'super_admin' | 'admin' | 'user'

/** Punya hak admin (admin ATAU super_admin). */
export const isAdminRole = (r?: string | null): boolean => r === 'admin' || r === 'super_admin'

/** Super admin (akses penuh, termasuk semua bucket pribadi). */
export const isSuperAdminRole = (r?: string | null): boolean => r === 'super_admin'

/** Label ramah untuk badge. */
export const roleLabel = (r?: string | null): string =>
  r === 'super_admin' ? 'super admin' : r === 'admin' ? 'admin' : 'user'
