# Yasa — Handoff

> Dokumen serah-terima state proyek. Dibuat 8 Jul 2026 · **terakhir diupdate 14 Jul 2026**. Baca ini dulu sebelum lanjut ngoding.
>
> ⚡ **State TERBARU ada di §18** (sesi 14 Jul lanjutan: audit keamanan + 5 fix, logging ke file, overhaul responsive, tombol Detail file, branding kustom super admin + caching, favicon/manifest). §17 = update besar sebelumnya (share publik folder, RBAC super_admin/god-mode). Kalau bentrok, **nomor lebih besar yang benar**. Domain **savgroup.my.id**. HEAD: commit `29c0813`.

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

> ⚠️ Kredensial asli TIDAK ditulis di sini (dokumen ini di-commit). Semua user/password/secret ada di `.env` server (gitignored).

- **MinIO**: `<HOST-MINIO>:9000` (API), console asli `:9001`. Root user & password → `.env` server. Rilis RELEASE.2025-09-07 (community, sudah archived — no CVE patch).
- **PostgreSQL 17**: Docker `:5432`, db `drive`, user & password → `.env` server. Bind ke IP Tailscale saja, volume host bind-mount, `restart: unless-stopped`, backup cron 02:00.
- Semua diakses dari laptop dev lewat **tailnet**.

## 4. Env (`.env`)

> ⚠️ Nilai NYATA hanya di `.env` server (gitignored). Di bawah cuma placeholder — jangan pernah commit kredensial asli. Lihat juga `.env.example`.

```
NUXT_SESSION_PASSWORD=<64 hex acak>       # sesi Console
NUXT_MINIO_ENDPOINT=http://<host-minio>:9000
DATABASE_URL=postgres://<user>:<password>@<host>:5432/drive
BETTER_AUTH_SECRET=<base64 32>
BETTER_AUTH_URL=<url publik app>
ADMIN_EMAILS=admin@yasatech.co.id        # email di sini → role admin saat signup Drive
NUXT_DRIVE_MINIO_ACCESS_KEY=<access key service account>
NUXT_DRIVE_MINIO_SECRET_KEY=<secret key>
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

- **auth.ts** — tabel better-auth: `user`, `session`, `account`, `verification`. Kolom tambahan di `user`: `role` (**super_admin/admin/user** — lihat §17.3), `storageQuota` (default 5 GiB), `storageUsed`, `bucket` (drive-{id}), `deletedAt` (soft delete).
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

> Password akun TIDAK ditulis di sini (dokumen di-commit). Simpan di tempat privat / password manager. Yang lama sudah bocor → sudah/harus direset.

| Email | Role |
|---|---|
| admin@yasatech.co.id | admin |
| budi@yasatech.co.id | user |
| siti@yasatech.co.id | user |

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

## 16. Status produksi & catatan terakhir (9 Jul 2026)

> ⚠️ **Domain sudah PINDAH ke `savgroup.my.id`** (lihat §17.0). URL `tegwa.my.id` di §16 ini historis. §16 item 2 (install `mc`) & `MINIO_SERVER_URL` sudah BERES per §17.

**SUDAH LIVE:** ~~https://drive.tegwa.my.id~~ → **https://drive.savgroup.my.id**

- **Repo GitHub:** `https://github.com/Praz-715/minio-drive` (branch `main`).
- **Server:** app di `/opt/minio-drive`, systemd unit **`yasa-drive.service`** (user `user1`), jalanin `node .output/server/index.mjs`, listen `0.0.0.0:3000`. **Tanpa nginx** — langsung **Cloudflare Tunnel** (cloudflared) → app. **MinIO & PostgreSQL di localhost server yang sama** (`.env`: `NUXT_MINIO_ENDPOINT=http://localhost:9000`, `DATABASE_URL=...@localhost:5432/drive`, `BETTER_AUTH_URL=https://drive.tegwa.my.id`). RAM server 15Gi (lega, bukan OOM).
- **Redeploy:** di server → `git pull && npm run build && sudo systemctl restart yasa-drive` (skip `npm ci`/`db:migrate` kalau dependency/schema gak berubah).

**Fix produksi 9 Jul 2026:**
- **Bucket provisioning race** (gejala: "klik pertama error, kedua sukses" saat write pertama tiap user). `ensureUserBucket` bikin bucket lalu langsung `mc quota set`; MinIO kadang belum register bucket baru → quota gagal attempt-1 (race). **Fix** (commit `39a4b13`): catat `user.bucket` ke DB DULU + `setBucketQuotaRetry` (backoff 3x) + quota NON-FATAL. `createBucketWithQuota` (tim) juga retry.
- **502 saat delete** = transient pas **restart redeploy** (cloudflared langsung ke app, ada ~1-2 dtk downtime saat `systemctl restart`), **BUKAN bug**. Delete diverifikasi live: soft/permanent/burst/folder-rekursif semua 200 & cepat. 502 random di luar window restart baru perlu diselidiki (cek `journalctl -u yasa-drive`).

**⚠️ MASIH HARUS DIKERJAKAN (penting):**
1. **ROTASI SECRET yang bocor** — commit lama `c7a7e4c` di GitHub sempat memuat kredensial asli (MinIO root & DB) di HANDOFF. HANDOFF sudah di-redact ke depan, TAPI history masih menyimpannya → **ganti password MinIO root & `drive_user` DB** (+ update `.env` server + restart). Belum dilakukan.
2. **Install `mc` di server** — `.env` prod belum ada `NUXT_MC_PATH`. Quota sekarang non-fatal (app gak error), tapi hard-quota MinIO gak beneran nempel sampai `mc` ada: `sudo curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc && sudo chmod +x /usr/local/bin/mc`, lalu tambah `NUXT_MC_PATH=/usr/local/bin/mc` di `.env` + restart.
3. **Bind app ke `127.0.0.1`** (sekarang `0.0.0.0:3000` — keekspos) via `Environment=HOST=127.0.0.1` di unit + `daemon-reload` + restart; pastikan `ufw` tutup 3000 dari luar (semua lewat CF).
4. Service account MinIO khusus (bukan root) + selaraskan `MINIO_SERVER_URL` ke host publik biar presigned URL & link publik `/s/` reachable dari luar.

## 17. Sesi 13–14 Jul 2026 — update besar (share publik folder, RBAC super_admin, dll)

> Ini status **TERBARU** & mengalahkan detail lama yang bentrok (domain, model role). HEAD saat ini: commit **`3963184`** (branch `main`, repo `Praz-715/minio-drive`). Semua kerjaan di bawah **sudah di-commit & push** dan **diverifikasi E2E live** di dev server (kecuali yang disebut belum).

### 17.0 Ganti domain → savgroup.my.id
- App: **https://drive.savgroup.my.id** · MinIO publik: **https://s3.savgroup.my.id** (via Cloudflare Tunnel). `tegwa.my.id` lama tidak dipakai.
- `.env` server: `BETTER_AUTH_URL=https://drive.savgroup.my.id`, `NUXT_MINIO_ENDPOINT=https://s3.savgroup.my.id` (WAJIB pakai `https://`), `DATABASE_URL=...@localhost:5432/drive`. `/etc/default/minio`: `MINIO_SERVER_URL="https://s3.savgroup.my.id"`.
- **`mc` SUDAH terinstall** di server (`NUXT_MC_PATH=/usr/local/bin/mc`) → hard-quota nempel. **§16 item 2 = DONE.** `MINIO_SERVER_URL` juga sudah selaras → presigned/link publik reachable dari luar.

### 17.1 Fix download/preview (endpoint tanpa skema)
Gejala: abis ganti domain, download & preview gagal (login/browse tetap OK karena itu cuma DB). Penyebab: `NUXT_MINIO_ENDPOINT=s3.savgroup.my.id` **tanpa `https://`** → `new URL()` lempar `ERR_INVALID_URL` → semua operasi MinIO (presign/upload/thumbnail) gagal. **Fix**: `minioEndpointUrl()` di `server/utils/minio.ts` — normalisasi (tanpa skema → prepend `https://`) + error jelas; dipakai `minioClientFor()` & `mc.ts`. Sekarang walau `.env` lupa skema tetap jalan.

### 17.2 Link publik FOLDER + auto-claim + editor-untuk-yang-login
Melengkapi `/s/[token]` biar setara Google Drive:
- **Folder bisa dibagikan lewat link** (dulu file saja). Halaman `/s/[token]` jadi **browser folder read-only**: breadcrumb, navigasi subfolder, preview/download per-file. Endpoint baru **`/api/s/[token]/browse.post.ts`** (tanpa sesi). `access.post` untuk link folder wajib `fileId` + **guard `isWithinFolder()`** (pengunjung tak bisa nyomot file di luar folder yang dibagikan; breadcrumb distop di root).
- **Auto-claim** (`/api/s/[token]/claim.post.ts`): pengunjung yang SUDAH login, saat buka link → otomatis dapat baris `fileShares` → muncul di "Dibagikan ke saya". **Hanya item PRIBADI** (item tim aksesnya lewat keanggotaan). Idempoten + **upgrade-only** (viewer→editor kalau link editor; TAK pernah turun). Banner "ditambahkan ke Drive kamu".
- **Link bisa viewer/editor** (`link.post` terima `permission`; editor hanya untuk item pribadi, item tim dipaksa viewer). ShareModal ada pilihan **Akses**; `link.get` balikin permission.
- **Anonim = read-only SELALU** (browse/preview/download; mengedit butuh akun). Halaman `/s/` punya **tombol Login & Daftar** (`?redirect` balik ke link). Abis login/daftar → auto-claim kasih permission link. `index.vue`/`register.vue` dukung `?redirect` (path internal saja, anti open-redirect).

### 17.3 RBAC full di DB + role **super_admin** (god-mode)
- Role: **`super_admin` > `admin` > `user`** (kolom `role` = **text**, TANPA migrasi DB).
- **Env role DIBUANG** — `ADMIN_EMAILS`/`SUPER_ADMIN_EMAILS` **TIDAK lagi** dipakai untuk role. User baru selalu `user`. Role dikelola PENUH lewat UI **Kelola User** (nulis ke DB).
- **Bootstrap owner** (`server/plugins/seed-roles.ts`): saat startup, HANYA kalau di DB belum ada `super_admin` sama sekali → set `admin@yasatech.co.id`→super_admin & `teguh.prasetyo@yasatech.co.id`→admin (owner **di-hardcode** di file itu; ganti konstanta di sana kalau owner beda). Begitu ada satu super admin → plugin no-op (TAK pernah menimpa perubahan UI). Aman dari lock-out.
- **super_admin = god-mode**: lihat SEMUA bucket termasuk bucket pribadi tiap user di Manajemen Bucket; bisa **browse/buka/download FILE APA PUN** milik siapa saja. `fileAccess()` short-circuit → super = `owner` atas semua file. Endpoint **`/api/drive/browse?owner={userId}`** (super-only) + halaman **`/drive/user-files/[id]`** (klik nama user di tabel Bucket Pribadi → jelajah Drive-nya, read-only di UI). Search (`special.get`) untuk super = cari di SEMUA file.
- **admin biasa**: kelola user + bucket bersama saja; **TIDAK** bisa lihat/buka file pribadi user lain (diverifikasi 403; `?owner=`/`/url`/search-all semua ditolak). Bucket Pribadi (per-user) di Manajemen Bucket **cuma tampil untuk super_admin**. Hanya super yang bisa **memberi/mengedit/menonaktifkan** akun super_admin.
- Helper: `app/utils/roles.ts` (`isAdminRole`/`isSuperAdminRole`/`roleLabel` — client) + `server/utils/auth.ts` (`isAdminRole`/`isSuperAdminRole`/`requireDriveSuperAdmin` — server). `requireDriveAdmin` sekarang lolos admin **dan** super_admin.

### 17.4 Perbaikan UI share & sidebar
- **Role terlihat di "Dibagikan ke saya"**: badge izin di halaman (kolom **"Akses kamu"**: `LIHAT SAJA`/`BISA EDIT`), sidebar (ikon), & header Browser saat buka folder yang dibagikan (berlaku juga untuk anggota bucket bersama yang bukan owner). Helper `permLabel()`/`permBadgeClass()` di `format.ts`. Badge dibikin **`whitespace-nowrap`** (tak kepotong 2 baris) + tanpa emoji (konsisten warna+teks, ala badge AKTIF/ADMIN).
- **Pemilik terlihat**: "Dibagikan ke saya" nampilin pemilik folder — sidebar "oleh {nama}"; halaman kolom Pemilik (desktop) + di bawah nama (HP).
- **Tombol "Lepaskan"**: penerima bisa melepas akses share dari daftarnya sendiri. `shares.delete` punya jalur **self-leave** (tanpa `userId` / `userId`=diri sendiri → hapus baris share sendiri tanpa perlu owner); file **TIDAK** dihapus, pemilik bisa share ulang. Owner mencabut akses user lain tetap seperti semula.
- **Sidebar scroll**: "Drive Bersama" & "Dibagikan ke saya" maks **~3 item** terlihat, sisanya scroll **di section itu saja** (`max-h` + `overflow-y-auto` + `.sidebar-scroll` di `main.css`; tinggi dikalibrasi dari tinggi item asli — team 32px→104px, share 41px→132px). Tidak lagi di-`slice`.

### 17.5 Fix dev 403 (CSRF)
`better-auth` `trustedOrigins` toleran di dev (percaya `localhost:3000/3001`) → `nuxt dev` tak kena **403** walau `BETTER_AUTH_URL` beda port. Produksi tetap ketat (hanya `BETTER_AUTH_URL`). Ada di `server/utils/auth.ts` (`isProd`).

### 17.6 File penting ditambah/berubah sesi ini
- **Baru**: `server/api/s/[token]/browse.post.ts`, `server/api/s/[token]/claim.post.ts`, `server/plugins/seed-roles.ts`, `app/utils/roles.ts`, `app/pages/drive/user-files/[id].vue`.
- **Berubah signifikan**: `server/utils/{auth,drive-files,minio,mc}.ts`, `server/api/drive/browse.get.ts`, `.../special.get.ts`, `.../buckets/index.get.ts`, `.../users/{index.post,[id].patch,[id].delete}.ts`, `.../files/[id]/{link.post,link.get,shares.delete}.ts`, `server/api/s/[token].get.ts`, `.../[token]/access.post.ts`, `app/components/drive/{Browser,ShareModal}.vue`, `app/layouts/drive.vue`, `app/pages/drive/{buckets,users,shared-with-me}.vue`, `app/pages/{index,register}.vue`, `app/pages/s/[token].vue`, `app/assets/css/main.css`.

### 17.7 Deploy & catatan
- **TIDAK ada migrasi DB** untuk semua kerjaan sesi ini (role = text; `shareLinks` sudah punya `fileId`). Deploy: `cd /opt/minio-drive && git pull && npm run build && sudo systemctl restart yasa-drive`.
- Saat restart, **bootstrap role** jalan (set owner kalau server belum punya super_admin). Cek: `journalctl -u yasa-drive -n 30 | grep -i bootstrap`. Kalau server sudah punya super tapi teguh belum admin → set manual di **Kelola User**.
- `ADMIN_EMAILS`/`SUPER_ADMIN_EMAILS` di `.env` server sekarang **tak terpakai** — boleh dihapus.
- Akun tes throwaway di DB **dev** (bukan produksi): `pengunjung.test@yasatech.co.id` (sering dinonaktifkan) — abaikan/hapus.

### 17.8 ⚠️ Outstanding (update)
1. 🔐 **ROTASI SECRET yang bocor** — MinIO root & DB pw pernah ke-commit (`c7a7e4c` di GitHub). **BELUM dilakukan. PALING KRITIS.** (ganti password MinIO root & `drive_user` → update `.env` server + `/etc/default/minio` + restart MinIO & app.)
2. **Service account MinIO khusus** (policy scoped) untuk `NUXT_DRIVE_MINIO_*` — masih pakai root `minio-admin`. (`mc` & `MINIO_SERVER_URL` **sudah beres**.)
3. **Bind app ke `127.0.0.1`** (masih `0.0.0.0:3000`) + tutup port 3000 dari luar (semua lewat CF).
4. Pastikan `.env` server `NUXT_MINIO_ENDPOINT` eksplisit `https://s3.savgroup.my.id` (kode sudah normalisasi, tapi eksplisit lebih rapi).
5. Rekomendasi lama (§15) yang masih relevan: `disableSignUp`/verifikasi email kalau internal, avatar belum dihitung di `storageUsed`, GC objek orphan saat move.

## 18. Sesi 14 Jul 2026 (lanjutan) — audit fix, logging, responsive, Detail, branding, favicon

> State **TERBARU**. HEAD: commit **`29c0813`** (branch `main`, repo `Praz-715/minio-drive`). Semua sudah di-commit & push, dan diverifikasi live (playwright + curl) di dev server (localhost:3000).

### 18.0 Urutan commit sesi ini
`54e3252` audit-fix → `149aed2` file-logger → `80ed3a1` env log → `e679e20` responsive → `5b8744c` Detail+mobile → `6ad840e` branding → `8a2955d` branding-cache → `29c0813` favicon.

### 18.1 Audit keamanan + 5 fix (commit `54e3252`)
Audit menyeluruh (5 reviewer paralel) atas semua endpoint & util. Verdict: **tak ada bypass auth kritis**; model izin inti solid. 5 temuan **medium diperbaiki + cross-check tanpa bentrok**:
1. **Super admin tak bisa turunkan role akun sendiri** dari super_admin — anti lock-out (`users/[id].patch.ts`: guard `iamSuper && role !== 'super_admin'`). UI `users.vue` memang sudah men-disable dropdown role utk diri sendiri.
2. **PATCH `/files/[id]` tolak body tanpa field ter-guard** — dulu body `{}` bikin `db.update` jalan tanpa cek akses (IDOR bump `updatedAt` file siapa pun). Sekarang butuh minimal `name`/`starred`, else 400.
3. **File di sampah tak bisa di-presign** — `files/[id]/url.get.ts` tolak `deletedAt` (404); `urls-batch.post.ts` skip trashed **kecuali milik sendiri** (biar thumbnail grid Sampah pemilik tetap jalan; trash view cuma nampilin item sendiri). Cegah penerima share download file yang sudah di-trash.
4. **Hapus permanen pakai recursive CTE** (bukan BFS batas 32 level) — `files.parentId` `ON DELETE CASCADE` menghapus SEMUA baris turunan, jadi objek MinIO + kuota harus diproses utk seluruh subtree; sebelumnya baris >32 level kehapus tapi objek nyangkut + `storageUsed` melenceng permanen. Ada koersi `size` bigint→number.
5. **Tombol "Ganti nama" di-guard** (`Browser.vue`): `v-if="!owner && (isOwner || canWrite)"` → hilang di view god-mode `?owner` (read-only) & utk viewer.

Temuan LOW yang **belum** ditambal (bukan blocker): rate-limit link password in-memory/per-token (DoS), Content-Disposition nama file belum di-escape, bootstrap `seed-roles` masih hitung super yang soft-deleted, guard super_admin di `restore`/`avatar` user, dsb.

### 18.2 Logging ke file (commit `149aed2`, `80ed3a1`)
`server/plugins/file-logger.ts` — Nitro plugin nulis ke file: `[boot]`, tiap request non-aset (`METHOD path → status (ms)`), `error` handler Nitro (500/throw), + `unhandledRejection`/`uncaughtException` (log lalu `exit(1)` biar systemd restart). Path via env **`NUXT_LOG_FILE`** (default `/tmp/yasa-drive.log` di Linux; **nonaktif di Windows** kecuali di-set → gak ganggu `npm run dev`). `.env.example` didokumentasikan; `.env` server pakai `/var/log/yasa-drive.log`. Lihat: `tail -f /var/log/yasa-drive.log`.
> ⚠️ `/var/log` punya root → file harus disiapkan: `sudo touch /var/log/yasa-drive.log && sudo chown user1:user1 /var/log/yasa-drive.log` (ganti user sesuai `systemctl show yasa-drive -p User`). Kalau `[boot]` tak muncul, hampir pasti izin tulis.

### 18.3 Overhaul responsive (commit `e679e20`, 19 file)
Cross-check semua front-end (5 reviewer) → tambal + verifikasi visual playwright @ **390 / 820 / 1440**. Tak ada breakage besar; ini poles. Fix: **Modal.vue** judul panjang `truncate`; **Toasts.vue** diangkat di atas FAB pas mobile; **MoveModal** label `truncate`; **s/[token]** header folder `truncate`; tabel list (Browser, drive `users`/`buckets`, `shared-with-me`) pakai **`table-fixed`** + sembunyikan kolom sekunder di mobile; cluster touch-target `<36px` dinaikkan (`h-8→h-9`, tombol `⋯`, dll — termasuk tabel aksi Console via `[&>button]`); layout: nama tim `truncate`, `<main>` `pb-24 lg:pb-6` (konten tak ketutup FAB), endpoint console `min-w-0`, angka "Objects" `text-2xl sm:text-3xl`.

### 18.4 Action bar mobile + kolom list + tombol Detail (commit `5b8744c`)
- **Action bar multi-select** (Download/Pindahkan/Sampah, + Pulihkan/Hapus di Sampah): **icon-only di mobile** (h-8, 1 baris), label balik di `sm+`.
- **List mobile**: kolom Ukuran juga disembunyikan → cuma Nama (panjang).
- **Tombol "Detail" di menu `⋯` (KHUSUS file, bukan folder)** → `app/components/drive/DetailModal.vue`: tipe (mime), lokasi (breadcrumb), ukuran, dibuat, diubah, pemilik, **akses** (daftar yang dibagikan + status link publik; "belum dibagikan" bila kosong; utk non-pemilik: "dibagikan ke kamu" / info bucket bersama). Endpoint baru **`GET /api/drive/files/[id]/detail`** (akses viewer+; daftar share hanya utk pemilik item pribadi).

### 18.5 Branding kustom — nama & logo (super admin) (commit `6ad840e`)
- Menu **"🎨 Edit Nama & Logo"** di dropdown profil layout drive — **KHUSUS super admin** (`v-if isSuperAdmin` + server `requireDriveSuperAdmin`).
- Modal (`app/components/drive/BrandingModal.vue`) 2 mode: **Bawaan** (logo "Y" + "YASA DRIVE") / **Kustom** (nama + upload logo ≤300KB → data URI, ada pratinjau).
- **Berlaku global**: halaman login `/`, sidebar `/drive`, `/register`, & link publik `/s` — semua render lewat komponen **`app/components/BrandMark.vue`** (baca `useBranding`). Di-hydrate SSR (tanpa flash) via `app/plugins/branding.ts`; update **reaktif seketika** setelah simpan (useState).
- **DB**: tabel baru **`app_settings`** (1 baris `id='app'`: `app_name`, `logo`, `updated_at`) — schema `server/db/schema/settings.ts`, **migrasi `0003_furry_changeling.sql`**. Endpoint `POST /api/branding` (super only, validasi ukuran).
- Console (`/console`) **TIDAK** ikut (di luar scope, tetap "YASA").

### 18.6 Branding caching — logo via endpoint gambar (commit `8a2955d`)
Optimasi supaya logo tak di-embed base64 di tiap payload & tak query DB tiap render:
- `server/utils/branding.ts`: **cache branding di memori** (invalidate saat `POST`). ⚠️ **per-proses** — aman utk 1 instance (systemd); kalau scale multi-instance nanti kasih TTL pendek.
- **`GET /api/branding`** (publik) kini cuma **metadata ringan** `{ appName, hasLogo, logoVersion }` (tanpa data URI).
- **`GET /api/branding/logo`** (publik) serve logo sebagai **gambar** dengan `Cache-Control: public, max-age=31536000, immutable` → **browser cache**; cache-bust via `?v=<logoVersion>` (= epoch `updatedAt`) saat logo diganti.
- **`GET /api/branding/edit`** (super only) → data URI penuh, cuma buat prefill modal.
- `BrandMark` pakai `<img src="/api/branding/logo?v=...">`.

### 18.7 Favicon + web manifest (commit `29c0813`)
- Aset favicon (twemoji 🗃️) dipindah dari `app/public/` (TIDAK dilayani di Nuxt 4) ke **`public/` di ROOT project** (baru ke-serve). **Gotcha Nuxt 4**: `public/` & `server/` di root, bukan di `app/`.
- `nuxt.config.ts` head: link favicon (`.ico` + 16/32 png) + `apple-touch-icon` + `manifest`; meta `theme-color` (light `#f4f5f7` / dark `#13161d`); **title default** jadi `Drive` (dari "Yasa Console — Object Storage"; sempat "Yasa Drive" lalu diedit user jadi "Drive").
- `public/site.webmanifest` diisi name/short_name + warna `#13161d`.
- Favicon = **statis** (identitas tab), beda dari **logo in-app** (§18.5) yang bisa dikustom.

### 18.8 Fakta operasional penting (BACA sebelum migrate/test)
- ⚠️ **DB dev = DB server (Postgres yang SAMA)**: `.env` dev `DATABASE_URL=...@192.168.1.111:5432/drive`, server `...@localhost:5432/drive` → instance & db yang sama. Jadi **`db:migrate`/test dari lokal LANGSUNG kena DB produksi**. Aman utk migrasi additive; hati-hati kalau ada migrasi destruktif.
- **Migrasi `0003` (app_settings) SUDAH di-apply** ke DB (dari lokal, disetujui user) → `npm run db:migrate` di server bakal **no-op** (tabel ada + tercatat). Deploy tetap `git pull && npm run build && sudo systemctl restart yasa-drive` (migrate opsional).
- **Akun tes** (dev, DB dipakai bareng): `teguh.prasetyo@yasatech.co.id` / `teguh123` = **super_admin** (naik dari admin di §17), `ichsan@yasatech.co.id` / `P@ssw0rd` = user biasa, `admin@yasatech.co.id` = super_admin (bootstrap owner). > Password akun asli JANGAN ditulis permanen; ini catatan sementara sesi dev.
- **Dev server** di-restart sesi ini (Nuxt **4.4.8**, :3000) karena ubah `nuxt.config` + tambah `public/`. Restart wajib tiap ubah `nuxt.config`/`public`.
- `app/public/` (lokasi lama favicon) sudah kosong/pindah — jangan taruh aset statis di situ lagi.

### 18.9 ⚠️ Outstanding (masih sama, belum berubah)
1. 🔐 **ROTASI SECRET bocor** (MinIO root `P@ssw0rd123!!!` + DB `Asdf123456`, ke-commit di history `c7a7e4c`) — **PALING KRITIS, BELUM.**
2. Service account MinIO khusus (masih root `minio-admin`).
3. Bind app ke `127.0.0.1` (masih `0.0.0.0:3000`) + tutup port 3000 dari luar.
4. (Baru, minor) branding cache per-proses → kasih TTL kalau multi-instance; LOW audit §18.1 (rate-limit link, escape Content-Disposition, guard restore/avatar super).
