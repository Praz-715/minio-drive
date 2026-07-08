# Yasa Console

Konsol admin MinIO buatan sendiri — pengganti web console community edition yang fiturnya dipangkas. Full-stack Nuxt 4, terhubung ke server MinIO via S3 API (`minio-js`) untuk operasi objek dan via `mc --json` untuk operasi admin (IAM/RBAC).

## Fitur

- **Login** dengan access key + secret key MinIO apa pun (root, user IAM, service account). Sesi disimpan sebagai sealed cookie terenkripsi — kredensial tidak pernah ditulis ke disk.
- **Dashboard** — mode server, drives online, jumlah bucket/objek, kapasitas & pemakaian storage, daftar server (khusus akun admin).
- **Buckets** — list, create, delete.
- **Object browser** — navigasi folder/prefix, breadcrumb, upload multi-file, create folder, download via presigned URL, hapus massal (multi-select).
- **Users** — list, tambah user (+generate secret), enable/disable, hapus, attach/detach policy.
- **Policies** — list built-in & custom, lihat dokumen JSON, buat policy baru dari editor JSON, hapus.
- **Access Keys** — list per user, generate key baru (secret ditampilkan sekali), hapus.

Menu admin otomatis disembunyikan kalau login dengan akun non-admin.

## Setup

```bash
npm install
```

Buat `.env`:

```bash
NUXT_SESSION_PASSWORD=<random 64 hex — openssl rand -hex 32>
NUXT_MINIO_ENDPOINT=http://192.168.1.111:9000
# opsional, kalau mc tidak ada di PATH dan tidak di ./bin
# NUXT_MC_PATH=/usr/local/bin/mc
```

Binary `mc` dicari di urutan: `NUXT_MC_PATH` → `./bin/mc(.exe)` → PATH.
Download: `https://dl.min.io/client/mc/release/<os>-<arch>/mc`

```bash
npm run dev      # development
npm run build    # production → node .output/server/index.mjs
```

## Arsitektur

```
Browser ──> Nuxt server routes (Nitro)
              ├─ operasi S3 (bucket/objek) ──> minio-js ──> MinIO :9000
              └─ operasi admin (IAM)       ──> mc --json ──> MinIO :9000
```

Kredensial user login dipakai untuk kedua jalur (alias `mc` didefinisikan per proses lewat env `MC_HOST_srv`), jadi RBAC MinIO berlaku apa adanya: user biasa tidak bisa memanggil endpoint admin.
