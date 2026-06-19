import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import LembuPutihTicket from '@/utils/LembuPutihTicket.json';

// --- MASUKKAN CONTRACT ADDRESS TERBARU ANDA DI SINI ---
const CONTRACT_ADDRESS = "0xCc6e1AD952f2a9C699DB1c00F7cA981A92cEe903"; 

export async function POST(request) {
    try {
        const body = await request.json();

        // 1. Cek status pembayaran dari notifikasi Midtrans
        const { transaction_status, custom_field1, custom_field2, custom_field3 } = body;

        // Jika status lunas (settlement) atau capture (kartu kredit)
        if (transaction_status === 'settlement' || transaction_status === 'capture') {
            console.log("✅ Webhook: Pembayaran Midtrans Lunas! Memulai minting NFT...");

            // 2. Mengekstrak kembali data Web3 yang kita titipkan
            const walletAddress = custom_field1;
            const visitorName = custom_field2;
            const [visitDate, quantityStr] = custom_field3.split('|');
            const quantity = parseInt(quantityStr);
            const tokenURI = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; 

            // 3. Menghubungkan ke Blockchain dengan Dompet Admin (Server-side)
            const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, wallet);

            // 4. Mengeksekusi fungsi adminMint (Biaya Gas ditanggung Admin)
            const tx = await contract.adminMint(walletAddress, quantity, tokenURI, visitorName, visitDate);
            console.log(`⏳ Menunggu validasi blockchain untuk TX: ${tx.hash}`);
            
            await tx.wait();
            console.log(`🎉 SUKSES! ${quantity} tiket NFT berhasil dikirim ke dompet ${walletAddress}`);
        }

        // Midtrans mewajibkan kita membalas HTTP 200 OK agar mereka tahu notifikasi sudah diterima
        return NextResponse.json({ status: "OK" });

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
