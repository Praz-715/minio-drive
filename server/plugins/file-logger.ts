import { appendFile } from 'node:fs/promises'

/**
 * Logger sederhana ke FILE — biar gampang dilihat kalau ada masalah di VPS.
 *
 *   tail -f /tmp/yasa-drive.log
 *
 * Tujuan default: `/tmp/yasa-drive.log` (Linux). Ganti lewat env `NUXT_LOG_FILE`.
 * Otomatis NONAKTIF di Windows (dev) kecuali `NUXT_LOG_FILE` di-set eksplisit —
 * jadi tidak mengganggu `npm run dev` di laptop.
 *
 * Yang dicatat: boot, tiap request non-aset (METHOD path → status (ms)),
 * error handler Nitro (500/throw dari API), plus unhandled rejection &
 * uncaught exception (log dulu, lalu exit(1) biar systemd bisa restart).
 *
 * Catatan: `/tmp` bisa dibersihkan otomatis (reboot / systemd-tmpfiles setelah
 * beberapa hari). Kalau mau log persist, set NUXT_LOG_FILE=/var/log/yasa-drive.log.
 */
export default defineNitroPlugin((nitroApp) => {
  const enabled = !!process.env.NUXT_LOG_FILE || process.platform !== 'win32'
  if (!enabled) return

  const LOG_FILE = process.env.NUXT_LOG_FILE || '/tmp/yasa-drive.log'
  let healthy = true

  function write(level: string, msg: string) {
    if (!healthy) return
    const line = `${new Date().toISOString()} [${level}] ${msg}\n`
    // O_APPEND → aman untuk penulisan bersamaan; kalau path gagal ditulis,
    // berhenti mencoba (jangan sampai logging bikin app ribut).
    appendFile(LOG_FILE, line).catch(() => {
      healthy = false
    })
  }

  write('boot', `yasa-drive start · pid=${process.pid} · node=${process.version} · log=${LOG_FILE}`)

  // lewati aset statis biar file log tidak banjir
  const SKIP = /^\/(?:_nuxt\/|__nuxt|_fonts\/|favicon)|\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|map)(?:\?|$)/i

  nitroApp.hooks.hook('request', (event) => {
    ;(event.context as any)._t0 = Date.now()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const path = event.path || ''
    if (SKIP.test(path)) return
    const status = event.node.res.statusCode
    const t0 = (event.context as any)._t0
    const ms = t0 ? Date.now() - t0 : 0
    write('req', `${event.method} ${path} → ${status} (${ms}ms)`)
  })

  nitroApp.hooks.hook('error', (error: any, ctx: any) => {
    const ev = ctx?.event
    const where = ev ? `${ev.method} ${ev.path}` : 'app'
    const code = error?.statusCode ? `[${error.statusCode}] ` : ''
    write('error', `${where} · ${code}${error?.message || error}${error?.stack ? '\n' + error.stack : ''}`)
  })

  process.on('unhandledRejection', (reason: any) => {
    write('unhandledRejection', `${reason?.message || reason}${reason?.stack ? '\n' + reason.stack : ''}`)
    process.exit(1)
  })
  process.on('uncaughtException', (err: any) => {
    write('uncaughtException', `${err?.message || err}${err?.stack ? '\n' + err.stack : ''}`)
    process.exit(1)
  })
})
