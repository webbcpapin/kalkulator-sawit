# Aplikasi Tax and Levy Ekspor Kelapa Sawit V3.2

File utama: `index.html`.

## Menjalankan lokal

Buka `index.html` langsung di browser untuk mode HTML tunggal, atau jalankan server statis sederhana agar manifest dan service worker aktif.

## Update HPE dan tarif bulanan

Update hanya berdasarkan dokumen resmi. Jangan menebak angka HPE, tarif Bea Keluar, atau tarif Pungutan Dana.

1. Perbarui `DATA.hpe` dari Kepmen Perdagangan periode terkait.
2. Perbarui `DATA.bk` dari Lampiran C PMK Bea Keluar yang berlaku.
3. Perbarui `DATA.pungutan` dari PMK BLU BPDPKS yang berlaku.
4. Pastikan kombinasi `Produk`, `HS Code`, range Harga Referensi, satuan tarif, dasar hukum, dan catatan tetap lengkap.
5. Uji ulang skenario kurs rendah, volume invalid, tarif kosong, CSV, Mode Privat, dan print.

## Deploy GitHub Pages

1. Commit folder `tax-levy-sawit`.
2. Di GitHub, buka Settings > Pages.
3. Pilih branch dan folder yang berisi `tax-levy-sawit`, atau pindahkan isi folder ini ke root repository jika ingin URL root.
4. Setelah deploy via HTTPS, `manifest.json` dan `service-worker.js` akan aktif otomatis.
