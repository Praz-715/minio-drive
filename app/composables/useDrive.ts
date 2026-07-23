/** Konteks lokasi aktif — di-set halaman, dibaca layout (tombol + Baru / FAB). */
export interface DriveCtx {
  parent: string // '' = root Files Saya
  canUpload: boolean
  label: string
}
export const useDriveCtx = () => useState<DriveCtx>('drive-ctx', () => ({ parent: '', canUpload: false, label: '' }))

/** Sinyal antar-komponen: layout memencet, halaman merespons (dan sebaliknya). */
export const useDriveSignals = () =>
  useState('drive-signals', () => ({
    upload: 0, // buka file picker di halaman aktif
    folder: 0, // buka modal folder baru
    sharedRefresh: 0, // refresh daftar Files Bersama di sidebar
    usageRefresh: 0, // refresh bar pemakaian storage
    uploadRefresh: 0, // sebuah upload selesai → halaman aktif refresh listing
  }))
