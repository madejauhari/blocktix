# BlockTix: Sistem E-Registrasi Tiket Wisata Berbasis Blockchain (NFT) 🎟️⛓️

**🌐 Akses Purwarupa Sistem (Live Demo): [https://blocktix-kappa.vercel.app/](https://blocktix-kappa.vercel.app/)**

Proyek ini merupakan purwarupa (prototype) Tugas Akhir Skripsi untuk mendemonstrasikan sistem e-registrasi tiket wisata menggunakan **Arsitektur Web 2.5**. Sistem ini dibangun dengan studi kasus simulasi pada **Destinasi Wisata Lembu Putih, Gianyar, Bali**.

Sistem ini mencetak tiket elektronik dalam bentuk **Non-Fungible Token (NFT) standar ERC-721** di jaringan Ethereum (Sepolia Testnet), memastikan bahwa tiket bersifat unik, tidak dapat dipalsukan (immutable), dan transparan. Proyek ini merupakan repositori privat dan tidak dibuka untuk publik (closed-source).

---

## ⚙️ Cara Kerja Sistem (Alur Workflow)

Sistem ini dirancang dengan pendekatan Web 2.5, yang berarti pengguna dapat berinteraksi dengan teknologi Web3 (Blockchain) menggunakan kemudahan antarmuka Web2 (sistem pembayaran konvensional). Berikut adalah alur kerjanya:

### 1. Alur Pengunjung (Pembeli Tiket)
*   **Autentikasi (Login):** Pengunjung menghubungkan dompet digital (*crypto wallet* seperti MetaMask) ke dalam sistem. Alamat dompet ini berfungsi sebagai identitas dan brankas penyimpanan tiket NFT nantinya.
*   **Pemesanan:** Pengunjung mengisi data diri (Nama dan Tanggal Kunjungan) pada halaman pemesanan tiket.
*   **Metode Pembayaran Paralel:**
    *   **Skenario Kripto (Pay with ETH):** Pengunjung membayar menggunakan saldo Ethereum. Transaksi diproses langsung melalui MetaMask, *gas fee* dibayar pengunjung, dan NFT langsung dicetak (*minting*) ke dompet pengguna.
    *   **Skenario Fiat (Pay with Rupiah):** Pengunjung membayar menggunakan uang Rupiah melalui *Payment Gateway* Midtrans (QRIS, Transfer Bank, dll). Setelah sukses, **Sistem (Backend) yang akan membayar gas fee dan mencetak NFT** ke dompet pengunjung secara otomatis.
*   **Penerimaan Tiket:** Setelah tervalidasi di jaringan *blockchain*, sistem akan men-generate dokumen PDF *E-Ticket* yang memuat identitas pengunjung dan *Blockchain Digital Footprint* (sebagai bukti keaslian) yang siap diunduh.

### 2. Alur Pengelola (Admin/Petugas)
*   **Konfigurasi Pasar (Market Configuration):** Admin (Pemilik Smart Contract) dapat mengubah harga tiket, menambah kuota, atau menutup/membuka penjualan. Semua konfigurasi ini disimpan secara permanen di dalam *Smart Contract*.
*   **Verifikasi Tiket di Gerbang (Gate Verification):** Saat pengunjung datang, petugas memasukkan Nomor ID Tiket ke dalam sistem. Sistem akan melakukan *query* langsung ke *Smart Contract* untuk mengecek keaslian tiket secara *real-time* (mencegah tiket palsu atau tiket ganda).
*   **Penarikan Dana (Withdraw Funds):** Pendapatan yang masuk dalam bentuk ETH dapat ditarik (*withdraw*) seutuhnya dari *Smart Contract* ke dompet pribadi Admin. Sementara pendapatan Fiat dapat ditarik melalui *dashboard merchant* Midtrans.

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

Walaupun kode sumber tertutup, berikut adalah teknologi utama yang menggerakkan sistem ini:
*   **Frontend:** Next.js, Tailwind CSS
*   **Web3 Integration:** Ethers.js v6
*   **Smart Contract:** Solidity ^0.8.20, OpenZeppelin (ERC-721), Hardhat
*   **Blockchain Network:** Ethereum Sepolia Testnet
*   **Payment Gateway:** Midtrans Snap API (Sandbox)
*   **Authentication:** MetaMask (Decentralized Wallet Login)

---

## 📄 Hak Cipta & Lisensi
Hak Cipta © 2026 **Made Jauhari** (NIM: 2205551116)  
Program Studi Teknologi Informasi, Fakultas Teknik, Universitas Udayana.  

*Proyek ini dikembangkan secara eksklusif untuk memenuhi persyaratan penyelesaian pendidikan Sarjana Strata Satu (S1). Tidak diperkenankan untuk menggandakan, menyalin, atau mendistribusikan kode sumber dari proyek ini tanpa izin tertulis.*
