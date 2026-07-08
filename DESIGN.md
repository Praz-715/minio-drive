# Design

## Theme

"Ops control room" dua mode. Dark = graphite/ink dengan aksen amber menyala (identitas utama, malam/ruang gelap). Light = abu dingin bersih dengan amber gelap (kantor, siang). Token semantik lewat skala `ink-*` yang membalik antar tema — komponen tidak tahu-menahu soal tema.

## Color

Skala CSS vars `--ink-*` (dibalik per tema) dipetakan ke Tailwind lewat `@theme inline`:

| Token | Dark | Light | Peran |
|---|---|---|---|
| ink-950 | #13161d | #f4f5f7 | page background |
| ink-900 | #171b23 | #fbfcfd | sidebar, input bg |
| ink-850 | #1c212b | #ffffff | card / panel |
| ink-800 | #232a36 | #eceff3 | hover row, subtle fill |
| ink-700 | #2e3644 | #e2e6ec | border default |
| ink-600 | #3c4655 | #c9d2dd | border kuat |
| ink-500 | #55617a | #97a3b4 | disabled |
| ink-400 | #8794a6 | #5c6b82 | teks muted |
| ink-300 | #a9b4c4 | #46536a | teks sekunder |
| ink-200 | #cad2de | #2c3a52 | teks kuat |
| ink-100 | #e3e8ef | #131c2b | teks utama |
| glow | #eaa93a | #9c6a04 | aksen/aksi primer |
| ok | #46cf88 | #0e7a4a | sukses/online |
| danger | #f0726f | #c22f2f | bahaya/error |

Aksen hanya untuk aksi primer, seleksi, dan status. Glow-shadow hanya di dark.

> **Dark v2 (8 Jul 2026)**: lantai dinaikkan dari near-black (#07090d) ke slate gelap adem (#13161d) + tangga elevasi lembut + amber diredam saturasinya + bloom glow dikecilin — mengatasi eye-strain kontras ekstrem near-black×amber-neon.

## Typography

- **Archivo** — UI/heading (400–900), tracking ketat di display
- **JetBrains Mono** — data: key, path, angka, label uppercase ber-tracking lebar
- Skala tetap (rem), rasio ~1.2; tabel boleh padat

## Components

- `.card` panel radius-xl border tipis; `.btn-primary` amber, `.btn-ghost` outline, `.btn-danger` tint merah
- `.badge-ok/-off/-dim` pill mono uppercase; chip tipe file 2–4 huruf
- `.tbl` header mono uppercase kecil, row hover tint
- Modal teleport + backdrop blur; Toggle switch amber; toast pojok kanan bawah

## Layout

Sidebar tetap 240px (nav bernomor mono) + konten max-w-6xl. Grid responsif `grid-cols-2 → 4` untuk stat, `2 → 5` untuk file grid.

## Motion

150–300ms ease-out; `rise` (fade+translate) untuk masuk halaman; transisi warna untuk hover; `prefers-reduced-motion` mematikan rise/transition.
