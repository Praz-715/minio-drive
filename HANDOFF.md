# Yasa — Handoff

> Dokumen serah-terima state proyek. Dibuat 8 Jul 2026. Baca ini dulu sebelum lanjut ngoding.

## 1. Apa ini

Aplikasi self-hosted di atas **MinIO** (object storage) dengan **dua area terpisah** dalam satu app Nuxt:

1. **Storage Console** (`/console/*`) — admin tool MinIO ala console community edition yang dulu (sebelum MinIO memangkasnya). Login pakai **access key + secret key MinIO**. Buat operator infra.
2. **Yasa Drive** (`/`, `/register`, `/drive/*`) — file-sharing ala Google Drive untuk end-user. Login pakai **email + password** (better-auth). Ini fokus pengembangan sekarang.

**`/` = halaman login Drive** (hero + form, layout dua-kolom, 8 Jul 2026). Console dijangkau lewat link "Storage Console" di halaman ini → `/console/login`. `/login` lama di-redirect ke `/` (routeRules). Logout & guard `/drive` (belum login) juga mengarah ke `/`. Kalau sudah login lalu buka `/` → auto ke `/drive`.

## 2. Tech stack

- **Nuxt 4** (srcDir `app/`) + **Tailwind v4** (`@tailwindcss/vite`, bukan module)
- **nuxt-auth-utils** — sesi Console (sealed cookie kredensial MinIO)
- **better-auth** — sesi Drive (email/password), endpoint di `/api/drive-auth/*` (SENGAJA bukan `/api/auth` biar tak bentrok)
- **Drizzle ORM** + **postgres.js** → PostgreSQL 17
- **minio-js** (SDK S3) + wrapper CLI **`mc`** (`bin/mc.exe`, gitignored) untuk operasi admin yang tak ada di SDK (quota, IAM, prometheus)
- Font: **Archivo** (UI) + **JetBrains Mono** (data). Tema light+dark via CSS vars `--ink-*` yang dibalik (`:root`=light, `.dark`=dark), toggle `toggleTheme()` di `app/utils/theme.ts`.

## 3. Infra (server user, via Tailscale)

- **MinIO**: `100.97.131.6:9000` (API), console asli `:9001`. Root user `minio-admin` / `P@ssw0rd123!!!`. Rilis RELEASE.2025-09-07 (community, sudah archived — no CVE patch).
  - Juga bisa via LAN `192.168.1.111:9000`.
- **PostgreSQL 17**: Docker di `100.97.131.6:5432`, db `drive`, user `drive_user` / `Asdf123456`. Bind ke IP Tailscale saja, volume host `/srv/ghanem/pgdata`, `restart: unless-stopped`, backup cron 02:00.
- Semua diakses dari laptop dev lewat **tailnet**.

## 4. Env (`.env`)

```
NUXT_SESSION_PASSWORD=<64 hex>            # sesi Console
NUXT_MINIO_ENDPOINT=http://100.97.131.6:9000
DATABASE_URL=postgres://drive_user:Asdf123456@100.97.131.6:5432/drive
BETTER_AUTH_SECRET=<base64 32>
BETTER_AUTH_URL=http://localhost:3001
ADMIN_EMAILS=admin@yasatech.co.id        # email di sini → role admin saat signup Drive
NUXT_DRIVE_MINIO_ACCESS_KEY=minio-admin  # service account backend Drive (sementara root)
NUXT_DRIVE_MINIO_SECRET_KEY=P@ssw0rd123!!!
# NUXT_DEMO=1                            # kalau di-set: SEMUA /api dijawab data palsu (desain tanpa server)
```

> **Demo mode**: tambah `NUXT_DEMO=1` → `server/middleware/demo.ts` menjawab semua API dengan fixture (buat kerja UI tanpa server). Hapus baris itu buat konek beneran.

## 5. Cara jalanin

```bash
npm install
npm run dev            # dev server (biasanya jatuh ke port 3001 karena 3000 kepakai app lain)
npm run db:generate    # buat migration dari perubahan schema
npm run db:migrate     # apply migration
npm run db:studio      # browse DB di browser
```

Kalau restart dev server: cek PID lama dulu (`netstat -ano | grep :3001`), `taskkill //PID <pid> //F`, baru `npm run dev` — Nuxt punya lock, gak bisa dua instance.

## 6. Database schema (`server/db/schema/`)

Migrations: `0000_drive-init`, `0001_user-soft-delete-bucket`, `0002_team-buckets`.

- **auth.ts** — tabel better-auth: `user`, `session`, `account`, `verification`. Kolom tambahan di `user`: `role` (admin/user), `storageQuota` (default 5 GiB), `storageUsed`, `bucket` (drive-{id}), `deletedAt` (soft delete).
- **files.ts** — `files` (file & folder satu tabel, tree via `parentId`, `teamBucketId` null=pribadi/terisi=bucket bersama, `objectKey` MinIO, soft-delete `deletedAt`=trash, `starred`), `fileShares` (share ke user, viewer/editor), `shareLinks` (token publik — expiry/password/counter; DIPAKAI oleh fitur Link Publik `/s/[token]`).
- **teams.ts** — `teamBuckets` (bucket bersama = bucket MinIO asli `team-{8hex}` + hard quota), `teamBucketMembers` (viewer/editor).

## 7. Model akses (penting)

- **Bucket pribadi per user**: `drive-{userId}`, hard-quota MinIO. Objek user disimpan di sini, `objectKey` = `f/{fileId}`.
- **Bucket bersama**: `team-{hex}`, hard-quota sendiri. Item bertim (`teamBucketId` terisi) disimpan di bucket tim — **kuota pribadi pengupload TIDAK kepakai**.
- **`fileAccess(userId, fileId)`** (`server/utils/drive-files.ts`) resolve izin: file tim → dari keanggotaan (uploader & admin = owner); file pribadi → owner, atau share langsung/lewat folder leluhur (viewer/editor).
- **`resolveWriteLocation()`** nentuin bucket tujuan upload/folder dari param `parent` (folder) atau `team` (root bucket bersama); kosong = root pribadi.
- **`bucketForFile()`** resolve bucket MinIO (pribadi/tim) sebuah file.

## 8. API (`server/api/`)

- `/api/drive-auth/[...all]` — handler better-auth
- `/api/drive/me`, `/me/avatar` — profil sendiri
- `/api/drive/browse` (`?parent=` / `?team=` / root), `/shared-roots` ({teams, shares}), `/special?view=recent|starred|trash|search`
- `/api/drive/upload` (kontekstual, field `parent`/`team`), `/folders`
- `/api/drive/files/[id]` — PATCH (rename/star), DELETE (`?permanent=1`), `/restore`, `/url` (presign), `/shares` (GET/POST/DELETE), `/link` (GET/POST/DELETE — link publik, owner only), **`/move` (POST { parent?, team? } — pindah ke Drive pribadi ATAU bucket bersama; lintas-bucket = objek MinIO dipindah fisik + teamBucketId subtree + kuota disesuaikan), **`/copy` (POST — gandakan item di lokasi sama, objek MinIO ikut disalin key baru, nama +" salinan{N}", rekursif utk folder)**
- **`/api/s/[token]`** (GET metadata) & **`/api/s/[token]/access`** (POST → presigned URL) — **PUBLIK, tanpa sesi**. Halaman `/s/[token]`. Password diverifikasi scrypt di `server/utils/share-link.ts`.
- `/api/drive/urls-batch` — presign massal (thumbnail grid)
- `/api/drive/users/*` — admin: CRUD user + avatar + soft-delete/restore (`requireDriveAdmin`)
- `/api/drive/buckets/*` — admin: list personal+team, create/patch/delete team bucket, members GET/POST/DELETE
- `/api/buckets/*`, `/api/admin/*`, `/api/auth/*`, `/api/meta` — semua punya **Console** (kredensial MinIO), jangan ketuker dengan `/api/drive/*`

Helper: `requireDriveSession`, `requireDriveAdmin` (`server/utils/auth.ts`).

## 9. UI (`app/`)

- **Layouts**: `console.vue` (sidebar Console), `drive.vue` (navbar search+theme+profil dropdown, sidebar +Baru/Drive Saya/**Drive Bersama**+submenu tim/**Dibagikan ke saya**+submenu share/Terbaru/Berbintang/Sampah/admin: Kelola User+Manajemen Bucket, FAB mobile = **speed-dial** (tap → Upload file + Folder baru), storage bar, DriveUploadTray), `blank.vue`, `default.vue`.
- **Komponen Drive** (`app/components/drive/`): `Browser.vue` (list/grid, mode browse/recent/starred/trash/search, aksi via modal ⋯), `FilePreview.vue`, `ShareModal.vue`, `MoveModal.vue`. Umum: `Modal.vue`, `Toggle.vue`, `Toasts.vue`.
- **Pages Drive**: `/drive` (root), `/drive/folder/[id]`, `/drive/team/[id]`, `/drive/shared` (Drive Bersama = bucket bersama/team saja), `/drive/shared-with-me` (Dibagikan ke saya = file/folder share langsung), `/drive/recent`, `/drive/starred`, `/drive/trash`, `/drive/search`, `/drive/users`, `/drive/buckets`.

> **Pemisahan share (8 Jul 2026)**: "Drive Bersama" (bucket team) & "Dibagikan ke saya" (file/folder share langsung) sengaja DIPISAH jadi 2 menu + 2 halaman, ala Google Drive "Shared drives" vs "Shared with me". API `shared-roots` tetap balikin `{teams, shares}`; sidebar & halaman tinggal pilih bagian yang relevan.
- **Komunikasi layout↔page**: `useDriveCtx` + `useDriveSignals` (`app/composables/useDrive.ts`) — layout memicu upload/folder, halaman merespons; ctx.canUpload nentuin FAB/tombol muncul.
- Utils: `app/utils/format.ts` (fmtBytes/fmtDate/fileChip/previewKind), `apiError()`.

## 10. Akun tes

| Email | Password | Role |
|---|---|---|
| admin@yasatech.co.id | `GantiNanti123!` | admin |
| budi@yasatech.co.id | `budiPass123` | user |
| siti@yasatech.co.id | `passwordBaru99` | user |

Data demo: folder "Dokumen" (admin) di-share ke Budi (editor); bucket bersama "Tim Marketing" (`team-7de6572e`, 10 GiB) dengan Budi sebagai editor.

## 11. Yang SUDAH jalan (diverifikasi E2E ke server asli)

- Console MinIO penuh: dashboard metrics, bucket CRUD, object browser (preview/grid/share/access public), IAM (users/policies/access keys)
- Drive auth: signup/login/logout, role otomatis via ADMIN_EMAILS, guard 2 area
- User management admin: CRUD + avatar + quota (hard-quota MinIO) + soft-delete (bucket tetap ada) + restore
- File manager Drive: upload kontekstual, folder, list/grid, preview, download, rename, move, star, trash/restore/permanent, share ke user (viewer/editor), presigned link, search (recursive CTE), kolom pemilik
- Bucket bersama: admin create (bucket MinIO+quota), assign member, user upload ke bucket tim (kuota pribadi utuh), viewer tak bisa upload
- **Upload UX (8 Jul 2026)**: antrean upload global (`useUpload.ts`, XHR per-file → progress bar per file di `UploadTray.vue` yang di-mount di layout, persist antar navigasi, bisa cancel/clear); drag & drop ke area Browser (overlay kontekstual); multi-select (checkbox list+grid, select-all, action bar: download/pindahkan/sampah, mode trash: pulihkan/hapus permanen). MoveModal digeneralisasi buat multi-item.
- **Link publik `/s/[token]` (8 Jul 2026)**: dari ShareModal → bikin link publik (expiry 1/7/30 hari/selamanya + password opsional). Halaman `/s/[token]` tanpa login: preview (image/video/pdf/audio/text) + download + gerbang password + counter unduh + state not-found/expired. Owner bisa cabut/buat-ulang. Satu link aktif per file.
- **Pindah lintas-bucket (8 Jul 2026)**: MoveModal punya pemilih lokasi (Drive Saya + tiap bucket bersama). Pindah pribadi↔tim / tim↔tim = endpoint `/move` menyalin objek MinIO seluruh subtree ke bucket tujuan, hapus dari sumber, ubah `teamBucketId`, sesuaikan kuota. Ke Drive pribadi hanya untuk item milik sendiri.
- **Buat Salinan (8 Jul 2026)**: menu aksi ⧉ Buat Salinan → endpoint `/copy` menggandakan file/folder (rekursif) di lokasi yang sama, objek MinIO disalin ke key baru, nama +" salinan{N}" (auto-increment). Salinan dimiliki penyalin; pribadi = +kuota (dicek), tim = butuh editor.
- **Feedback loading (8 Jul 2026)**: top progress bar global `<NuxtLoadingIndicator>` (app.vue, warna `--glow`) digerakkan plugin `app/plugins/api-loading.client.ts` yang membungkus `globalThis.$fetch` (ref-count → nyala tiap ada request API). Form create-folder & rename dikasih guard anti double-submit + label "Membuat…/Menyimpan…" (dulu Enter di-spam → folder kebuat banyak).
- Responsive (drawer mobile, FAB, touch actions), tema light/dark

## 12. Known issues / catatan

- **Presigned URL pakai host `192.168.1.111`** (dari `MINIO_SERVER_URL` di server), bukan IP Tailscale → link download optimal dari LAN. Fungsional OK. Fix: selaraskan `MINIO_SERVER_URL` di `/etc/default/minio` server.
- **Service account Drive masih pakai root MinIO** (`minio-admin`). Idealnya bikin user MinIO khusus + policy scoped, taruh di `NUXT_DRIVE_MINIO_*`.
- **Password DB & MinIO** masih default/lemah — aman karena tailnet-only, tapi ganti kalau port pernah dibuka lebih lebar. `admin@yasatech.co.id` passwordnya harus diganti (namanya aja "GantiNanti").
- **Link publik `/s/[token]`** presigned URL-nya juga pakai host MinIO server (LAN 192.168.1.111) — di dalam LAN/tailnet aman, tapi buat share ke ORANG LUAR beneran, MinIO harus reachable publik (Cloudflare tunnel `s3.tegwa.my.id`) DAN app-nya juga (`getRequestURL().origin` yang jadi base `/s/`). Selama masih localhost/tailnet, link cuma jalan di jaringan itu.
- Gotcha Tailwind v4: `@apply` tak bisa refer class custom → pakai selector list. Gotcha Nuxt 4: `assets/` harus di `app/assets/`. Gotcha Vue: deklarasi `ref` harus di atas `watch immediate` (TDZ).

## 13. Next steps (kandidat)

1. Service account MinIO khusus (bukan root) untuk backend Drive
2. Selaraskan `MINIO_SERVER_URL` biar presigned URL (termasuk link publik) jalan via Tailscale/tunnel — makin penting sekarang ada `/s/[token]`
3. Trash auto-purge terjadwal; recent lintas bucket tim
4. Upload folder (dir upload via `webkitdirectory`); resume/retry upload yang gagal
5. Link publik: dukung folder (browse publik), QR code, batas jumlah unduh

> ✅ **Sudah selesai 8 Jul 2026**: Upload UX (progress+drag&drop+multi-select), pemisahan Drive Bersama vs Dibagikan ke saya, Link Publik `/s/[token]` — lihat §11.

## 14. Memori Claude

State lengkap juga tersimpan di memori Claude Code: `yasa-drive-project.md` (recall otomatis tiap sesi di direktori ini).

## 15. Pre-deploy audit & checklist (8 Jul 2026)

Audit menyeluruh (2 reviewer paralel) sebelum deploy. **Bug yang ditemukan sudah diperbaiki & diverifikasi E2E:**

- **C1 (data integrity):** upload/folder ke dalam folder pribadi milik orang lain (share editor) dulu menyimpan objek ke bucket salah → download 404 + kuota nyasar. Fix: `resolveWriteLocation()` kini mengembalikan `ownerId`; item baru mengikuti pemilik ruang tujuan → objek/kuota/`bucketForFile()` selalu sinkron.
- **H3:** soft-delete folder kini REKURSIF (subtree di-stamp `deletedAt` batch-timestamp yang sama); restore memulihkan hanya yang dibuang di batch sama. Sebelumnya isi folder ter-trash bocor ke Recent/Starred/Search & masih bisa diunduh.
- **M4:** kuota `storageUsed` dihitung PER FILE saat upload (anti-drift kalau gagal di tengah).
- **M6:** move lintas-bucket kini menyertakan turunan yang di-trash (objek + `teamBucketId` ikut pindah).
- **H2:** `PATCH /files/[id]` menolak `parentId` (semua pindah wajib lewat `/move`).
- **L8:** nama file di-sanitasi saat upload (buang path separator & kontrol char).
- **Link publik:** ditolak kalau pemilik file dinonaktifkan; percobaan password di-rate-limit (10/10 menit per token, in-memory).
- **Demo mode** otomatis diabaikan kalau `NODE_ENV=production` (dulu = auth bypass).
- **Cookie/CSRF:** better-auth `useSecureCookies` di produksi + `trustedOrigins` dari `BETTER_AUTH_URL`.

**Checklist sebelum deploy:**

1. `cp .env.example .env` lalu isi. Generate `NUXT_SESSION_PASSWORD` (`openssl rand -hex 32`) & `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) yang KUAT.
2. Set `BETTER_AUTH_URL` ke domain publik asli (https), `NODE_ENV=production`.
3. **JANGAN** set `NUXT_DEMO` di produksi.
4. Buat **service account MinIO khusus** (policy scoped) untuk `NUXT_DRIVE_MINIO_*` — jangan pakai root `minio-admin`.
5. Ganti password default: DB (`drive_user`), MinIO root, dan akun admin (`admin@yasatech.co.id` yang masih "GantiNanti").
6. Selaraskan `MINIO_SERVER_URL` di server MinIO ke host publik (tunnel `s3.tegwa.my.id`) supaya presigned URL (download & link publik `/s/`) reachable dari luar.
7. `npm run db:migrate` di target.
8. Reverse-proxy TLS di depan app; pastikan cookie `Secure` aktif (otomatis via `useSecureCookies` saat production).

**Rekomendasi (belum dikerjakan, bukan blocker):** self-registration `/register` publik — kalau tool internal, pertimbangkan `disableSignUp` atau email verification. Genericisasi pesan error yang membocorkan detail MinIO (mis. `auth/login.post.ts`). Avatar belum dihitung di `storageUsed` (≤2MB/user). Permanent-delete BFS dibatasi depth 32. Cleanup objek sumber saat move bersifat best-effort (bisa orphan → butuh GC).
