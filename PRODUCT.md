# Product

## Register

product

## Users

Teguh (developer/admin Yasatech) sebagai operator storage hari ini; ke depannya karyawan/klien Yasatech sebagai end-user aplikasi file-sharing ala Drive. Konteks pemakaian: kerja harian di kantor (siang, ruangan terang) dan malam di rumah — dua kondisi cahaya, dua tema.

## Product Purpose

Yasa Console: konsol admin self-hosted untuk MinIO (pengganti console community yang dipangkas), yang akan berevolusi jadi software file-sharing ala Google Drive. Sukses = semua operasi storage (bucket, objek, IAM, sharing) bisa dilakukan tanpa CLI, dan file bisa dibagikan dengan aman dalam hitungan detik.

## Brand Personality

Ops-grade, tegas, presisi. "Control room" — alat kerja infrastruktur yang terasa serius tapi tidak dingin; aksen amber sebagai sinyal, bukan dekorasi.

## Anti-references

- Template admin dashboard generik (Bootstrap/CoreUI look-alike)
- Console MinIO AIStor yang steril korporat
- SaaS landing aesthetics (gradient ungu, glassmorphism) — ini alat kerja, bukan brosur

## Design Principles

1. **Data dulu, dekorasi belakangan** — tabel padat, angka mono, status selalu terlihat
2. **Familiar itu fitur** — affordance standar (tabel, modal, toggle); kejutan disimpan untuk momen kecil
3. **Satu kosakata visual** — tombol, badge, chip, input sama persis di semua halaman
4. **Aksi berbahaya selalu mahal** — hapus/public butuh konfirmasi eksplisit + warning merah
5. **Kondisi nyata diberi tahu** — loading skeleton, empty state yang mengajari, error dengan alasan asli

## Accessibility & Inclusion

Kontras teks ≥4.5:1 di kedua tema; status tidak pernah pakai warna saja (selalu ada label/ikon); prefers-reduced-motion dihormati; keyboard-friendly untuk form utama.
