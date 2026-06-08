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

## Backend Google Apps Script

File backend tersedia di `apps-script/Code.gs`.

Setup ringkas:

1. Buat Google Spreadsheet untuk database transaksi.
2. Buka Extensions > Apps Script.
3. Salin `apps-script/Code.gs` dan `apps-script/appsscript.json`.
4. Di Apps Script, buka Project Settings > Script properties.
5. Tambahkan `ADMIN_PASSWORD` dengan nilai password admin backend.
6. Tambahkan `SPREADSHEET_ID` jika script tidak terikat langsung ke Spreadsheet.
7. Jalankan fungsi `setupBackend()` sekali untuk membuat sheet `Transactions`, `MasterData`, dan `AuditLog`.
8. Deploy > New deployment > Web app.

Endpoint:

- `GET ?action=health`
- `GET ?action=transactions&limit=100`
- `GET ?action=master`
- `POST {"action":"appendTransaction","transaction":{...}}`
- `POST {"action":"deleteTransaction","id":"..."}`
- `POST {"action":"clearTransactions","adminPassword":"..."}`
- `POST {"action":"saveMasterData","adminPassword":"...","data":{...}}`

Catatan: frontend saat ini tetap offline-first dan belum otomatis mengirim transaksi ke backend.
