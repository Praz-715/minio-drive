/**
 * Antrean upload global (persist antar navigasi karena disimpan di useState).
 * Tiap file diupload SATU per satu lewat XMLHttpRequest supaya dapat progress
 * per-file (fetch/$fetch tidak mengekspos upload progress). Endpoint
 * /api/drive/upload sudah menerima satu file per request.
 */

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  name: string
  size: number
  loaded: number
  status: UploadStatus
  error?: string
}

interface UploadCtx {
  parent: string
  team: string
}

// Payload & XHR nyata disimpan di luar useState (tidak serializable, client-only).
const payloads = new Map<string, { file: File; ctx: UploadCtx }>()
const xhrs = new Map<string, XMLHttpRequest>()

export const useUploadQueue = () => useState<UploadItem[]>('drive-uploads', () => [])

let running = false

export function useUpload() {
  const queue = useUploadQueue()
  const signals = useDriveSignals()

  function genId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  function parseErr(xhr: XMLHttpRequest): string {
    try {
      const j = JSON.parse(xhr.responseText)
      return j?.message || j?.statusMessage || `Gagal (${xhr.status})`
    } catch {
      return `Gagal (${xhr.status || 'koneksi'})`
    }
  }

  function uploadOne(item: UploadItem): Promise<void> {
    return new Promise((resolve) => {
      const payload = payloads.get(item.id)
      if (!payload) {
        item.status = 'error'
        item.error = 'file hilang'
        return resolve()
      }
      const form = new FormData()
      form.append('parent', payload.ctx.parent || '')
      form.append('team', payload.ctx.parent ? '' : payload.ctx.team || '')
      form.append('files', payload.file, payload.file.name)

      const xhr = new XMLHttpRequest()
      xhrs.set(item.id, xhr)
      xhr.open('POST', '/api/drive/upload')
      xhr.withCredentials = true
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) item.loaded = e.loaded
      }
      xhr.onload = () => {
        xhrs.delete(item.id)
        payloads.delete(item.id)
        if (xhr.status >= 200 && xhr.status < 300) {
          item.loaded = item.size
          item.status = 'done'
          signals.value.usageRefresh++
          signals.value.uploadRefresh++
        } else {
          item.status = 'error'
          item.error = parseErr(xhr)
        }
        resolve()
      }
      xhr.onerror = () => {
        xhrs.delete(item.id)
        payloads.delete(item.id)
        item.status = 'error'
        item.error = 'koneksi gagal'
        resolve()
      }
      xhr.onabort = () => {
        xhrs.delete(item.id)
        payloads.delete(item.id)
        resolve()
      }
      item.status = 'uploading'
      xhr.send(form)
    })
  }

  async function pump() {
    if (running) return
    running = true
    try {
      // selalu ambil ulang dari state — item bisa ditambah saat loop jalan
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = queue.value.find((i) => i.status === 'queued')
        if (!next) break
        await uploadOne(next)
      }
    } finally {
      running = false
    }
  }

  function enqueue(fileList: FileList | File[], ctx: UploadCtx) {
    const arr = Array.from(fileList)
    if (!arr.length) return
    for (const file of arr) {
      const id = genId()
      payloads.set(id, { file, ctx })
      queue.value.push({ id, name: file.name, size: file.size, loaded: 0, status: 'queued' })
    }
    pump()
  }

  /** Batalkan (abort kalau sedang jalan) lalu buang dari antrean. */
  function cancel(id: string) {
    const xhr = xhrs.get(id)
    if (xhr) xhr.abort()
    payloads.delete(id)
    queue.value = queue.value.filter((i) => i.id !== id)
  }

  /** Buang item yang sudah selesai/gagal dari daftar. */
  function clearFinished() {
    queue.value = queue.value.filter((i) => i.status === 'queued' || i.status === 'uploading')
  }

  return { queue, enqueue, cancel, clearFinished }
}
