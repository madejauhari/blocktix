import midtransClient from 'midtrans-client';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        // Menerima data dari frontend
        const { idrTotal, quantity, name, date, walletAddress } = await request.json();

        // Inisialisasi Midtrans
        let snap = new midtransClient.Snap({
            isProduction: false, // Wajib false untuk Sandbox
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
        });

        // Membuat Order ID unik
        const orderId = "LPT-IDR-" + Math.floor(Math.random() * 1000000);

        // Parameter yang dikirim ke Midtrans
        let parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: Math.round(idrTotal) // Midtrans tidak menerima angka desimal
            },
            customer_details: {
                first_name: name,
            },
            // TRIK WEB2.5: Menitipkan data Web3 ke dalam sistem Midtrans
            custom_field1: walletAddress,
            custom_field2: name,
            custom_field3: `${date}|${quantity}` // Digabung karena limit custom field
        };

        const transaction = await snap.createTransaction(parameter);
        
        // Mengembalikan token ke frontend untuk memunculkan popup
        return NextResponse.json({ token: transaction.token });

    } catch (error) {
        console.error("Error generate token:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}