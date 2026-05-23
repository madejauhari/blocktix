"use client";
import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { jsPDF } from "jspdf"; 
import Link from 'next/link'; 
import LembuPutihTicket from '@/utils/LembuPutihTicket.json';

// --- KONFIGURASI ---
const CONTRACT_ADDRESS = "0x7495cAD923061e57481e764E70F80B9F3Ff2BFe0"; 

export default function Home() {
  // --- STATE LOGIC ---
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [ticketCount, setTicketCount] = useState(0);
  const [myTokenIds, setMyTokenIds] = useState([]);
  
  // --- STATE KONVERSI API TOKOCRYPTO/COINGECKO ---
  const [ethRateIDR, setEthRateIDR] = useState(0);
  
  // Market State
  const [dynamicPrice, setDynamicPrice] = useState("0");
  const [isSaleOn, setIsSaleOn] = useState(false);
  const [soldOut, setSoldOut] = useState(false);
  const [maxSupply, setMaxSupply] = useState(0);
  const [totalMinted, setTotalMinted] = useState(0);

  // Form State
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [visitorName, setVisitorName] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [dateError, setDateError] = useState(""); 

  // UI State
  const [isScrolled, setIsScrolled] = useState(false);
  const bookingSectionRef = useRef(null);

  // --- HELPER: Tanggal Hari Ini ---
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // --- HELPER VISUAL ID ---
  const formatVisualID = (id) => {
     const uniquePart = CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 4);
     const paddedId = String(id).padStart(4, '0'); 
     return `LPT-${uniquePart}-${paddedId}`;
  };

  // --- FUNGSI API: MENGAMBIL HARGA ETH KE IDR SECARA REALTIME ---
  const fetchEthRate = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr');
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.idr) {
        setEthRateIDR(parseFloat(data.ethereum.idr));
      }
    } catch (error) {
      console.error("Gagal mengambil data konversi harga (Cek koneksi internet Anda):", error);
    }
  };

  // --- HELPER: FORMAT ANGKA KE RUPIAH ---
  const formatToIDR = (ethAmount) => {
    if (!ethRateIDR) return "Memuat harga...";
    const totalIdr = parseFloat(ethAmount) * ethRateIDR;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(totalIdr);
  };

  // --- [REVISI PAK ALAM] PDF GENERATOR UPDATE ---
  const downloadTicketPDF = async (tokenId) => {
    if(!window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
    
    const details = await contract.getTicketDetails(tokenId);
    const dbName = details[0]; 
    const dbDate = details[1]; 
    const uniqueID = formatVisualID(tokenId);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const img = new Image();
    img.src = "/ticket-bg.png"; 
    img.onload = function() {
        doc.addImage(this, 'PNG', 10, 10, 200, 65);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 50, 100);
        
        doc.setFontSize(14); doc.text(uniqueID, 24, 50); 
        doc.setFontSize(12); doc.text(dbName.toUpperCase(), 24, 64); 
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(dbDate, 113, 54); 

        doc.setFont("courier", "normal"); 
        doc.setFontSize(9); 
        doc.text(account, 112, 70); 

        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("*The above address is the Public Key as proof of transparency of NFT asset ownership.", 10, 82);
        doc.text(`Smart Contract: ${CONTRACT_ADDRESS}`, 10, 86);

        doc.save(`BlockTix-Ticket-${uniqueID}.pdf`);
    };
  };

  // --- CONTRACT INTERACTION & SCROLL FIX ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }
    checkWalletAndTicket();
    fetchMarketStatus();
    fetchEthRate(); 

    // --- [BARU] INJECT MIDTRANS SNAP SCRIPT (Ubah ke .sandbox jika testing, hapus .sandbox jika production) ---
    const script = document.createElement("script");
    script.src = "https://app.midtrans.com/snap/snap.js"; 
    script.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.body.appendChild(script);

    const handleScroll = () => {
        setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    
    // Cleanup script saat komponen unmount
    return () => {
        window.removeEventListener('scroll', handleScroll);
        if (document.body.contains(script)) {
            document.body.removeChild(script);
        }
    };
  }, []);

  // --- [UPDATE KRUSIAL]: MEMBACA DATA DARI PUBLIC RPC ---
  const fetchMarketStatus = async () => {
    try {
      // Gunakan Public Node agar sistem tidak bergantung pada MetaMask pengunjung
      const publicProvider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, publicProvider);
      
      const price = await contract.ticketPrice();
      const active = await contract.isSaleActive();
      const max = await contract.maxSupply();
      const sold = await contract.totalMinted();
      
      setDynamicPrice(ethers.formatEther(price));
      setIsSaleOn(active);
      setMaxSupply(Number(max));
      setTotalMinted(Number(sold));
      if (Number(sold) >= Number(max)) setSoldOut(true);
    } catch (err) { 
      console.error("Gagal menarik data blockchain via Public RPC:", err); 
    }
  };

  const checkWalletAndTicket = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          checkOwnership(accounts[0].address, provider);
        }
      } catch (err) { console.error(err); }
    }
  };

  const checkOwnership = async (userAddress, provider) => {
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
      const balance = await contract.balanceOf(userAddress); 
      setTicketCount(Number(balance));

      if (Number(balance) > 0) {
        const tokenIds = await contract.getWalletTickets(userAddress);
        const formatedIds = tokenIds.map(id => Number(id)); 
        setMyTokenIds(formatedIds);
      } else {
        setMyTokenIds([]);
      }
    } catch (err) { console.error(err); }
  };

  // --- FUNGSI LOGIN / CONNECT ---
  const connectWallet = async () => {
    if (!window.ethereum) return alert("Metamask is not detected! Please install Metamask extension first.");
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setAccount(address);
        checkOwnership(address, provider);
        // Tetap tarik data terbaru saat login
        fetchMarketStatus();
    } catch (error) {
        console.error("User rejected connection", error);
    }
  };

  // --- FUNGSI LOGOUT ---
  const disconnectWallet = () => {
    setAccount(null);
    setTicketCount(0);
    setMyTokenIds([]);
    setVisitorName("");
    setVisitDate("");
    alert("Logged out from Dashboard.");
  };

  // --- OPSI 1: PEMBAYARAN MURNI WEB3 (ETH) ---
  const buyTicket = async () => {
    if (!account) return alert("Please connect wallet first!");
    if (!visitorName || !visitDate) return alert("Please fill in Name and Visit Date!");
    if (visitDate < getTodayDate()) return alert("Invalid Date!");

    setLoading(true);
    setStatus("Processing transaction...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);
      
      const tokenURI = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; 
      const totalPrice = ethers.parseEther(dynamicPrice) * BigInt(buyQuantity);

      const tx = await contract.buyTicket(buyQuantity, tokenURI, visitorName, visitDate, { value: totalPrice });
      setStatus("Waiting for block confirmation...");
      await tx.wait(); 
      
      setStatus("Success!");
      alert("Purchase Successful!");
      checkOwnership(account, provider); 
      fetchMarketStatus(); 
    } catch (err) {
      console.error(err);
      setStatus("Failed: " + (err.reason || err.message));
    }
    setLoading(false);
  };

  // --- [BARU] OPSI 2: PEMBAYARAN RUPIAH (MIDTRANS) ---
  const buyWithRupiah = async () => {
    if (!account) return alert("Please connect wallet first! (We need your address to send the NFT)");
    if (!visitorName || !visitDate) return alert("Please fill in Name and Visit Date!");
    if (visitDate < getTodayDate()) return alert("Invalid Date!");
    if (!ethRateIDR) return alert("System is loading exchange rates, please try again in a few seconds.");

    setLoading(true);
    setStatus("Requesting payment token from Midtrans...");

    try {
        const ethTotal = parseFloat(dynamicPrice) * buyQuantity;
        const idrTotal = ethTotal * ethRateIDR;

        const response = await fetch('/api/midtrans-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idrTotal: idrTotal,
                quantity: buyQuantity,
                name: visitorName,
                date: visitDate,
                walletAddress: account
            })
        });

        const data = await response.json();
        
        if (data.token) {
            setStatus("Waiting for your payment...");
            window.snap.pay(data.token, {
                onSuccess: function(result){
                    setStatus("Payment Success! The server is now minting your NFT...");
                    alert("Payment Success! Please wait ~30 seconds for the Blockchain to validate the minting, then refresh the page.");
                    setLoading(false);
                },
                onPending: function(result){
                    setStatus("Payment Pending. Please complete your transaction.");
                    setLoading(false);
                },
                onError: function(result){
                    setStatus("Payment Failed!");
                    setLoading(false);
                },
                onClose: function(){
                    setStatus("Payment window closed.");
                    setLoading(false);
                }
            });
        } else {
            setStatus("Failed to get payment token.");
            setLoading(false);
        }
    } catch (err) {
        console.error(err);
        setStatus("Error: " + err.message);
        setLoading(false);
    }
  };

  const scrollToBooking = () => {
    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="font-sans text-gray-900">
      
      {/* 1. NAVBAR */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
            
            <Link 
                href="/" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
                <div className="flex flex-col">
                    <h1 className={`text-2xl font-bold tracking-tighter cursor-pointer ${isScrolled ? 'text-green-900' : 'text-white'}`}>
                        BlockTix System
                    </h1>
                    <span className={`text-[10px] tracking-widest uppercase ${isScrolled ? 'text-gray-500' : 'text-green-200'}`}>
                        Simulation Mode: Lembu Putih
                    </span>
                </div>
            </Link>
            
            <div className="flex items-center gap-3">
                {!account ? (
                    <button 
                        onClick={connectWallet} 
                        className="px-6 py-2 rounded-full font-semibold transition-all shadow-lg bg-green-600 hover:bg-green-700 text-white"
                    >
                        Connect Wallet
                    </button>
                ) : (
                    <>
                        <div className="hidden md:block px-4 py-2 bg-green-100 text-green-800 border border-green-300 rounded-full font-mono text-sm font-bold shadow-sm">
                            🟢 {account.substring(0,6)}...{account.substring(38)}
                        </div>
                        <button 
                            onClick={disconnectWallet}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold shadow-lg transition-all text-sm flex items-center gap-1"
                        >
                            <span>🚪</span>
                        </button>
                    </>
                )}
            </div>

        </div>
      </nav>

      {/* 2. HERO */}
      <header className="relative h-screen flex flex-col justify-center items-center text-center px-4 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 blur-sm scale-110 transition-all duration-700" 
          style={{ backgroundImage: "url('/hero-bg.jpg')" }} 
        ></div>
        <div className="absolute inset-0 bg-black/40 z-0"></div> 

        <div className="relative z-10 text-white max-w-4xl space-y-6">
            <p className="text-lg md:text-xl font-medium tracking-widest uppercase text-green-300">
                Decentralized E-Ticketing
            </p>
            <h1 className="text-5xl md:text-7xl font-bold font-serif leading-tight">
                Secure & Transparent <br/> Travel Experience
            </h1>
            <p className="text-gray-200 text-lg md:text-xl max-w-2xl mx-auto">
                Prototype Demonstration using Case Study: <strong>Lembu Putih, Gianyar</strong>.
                Powered by Ethereum Smart Contract & NFT Standard.
            </p>
            <div className="pt-8">
                <button 
                    onClick={scrollToBooking}
                    className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-lg font-bold rounded-full transition transform hover:scale-105 shadow-xl flex items-center gap-2 mx-auto"
                >
                    Buy Tickets <span className="text-xl">→</span>
                </button>
            </div>
        </div>
      </header>

      {/* 3. INFO */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
                <span className="text-green-600 font-bold tracking-wider text-sm">SIMULATION DATA</span>
                <h2 className="text-4xl font-bold text-gray-900 font-serif">A Sanctuary of Peace in Taro Village</h2>
                <p className="text-gray-600 leading-relaxed">
                    Lembu Putih (The White Ox) sanctuary is used here as a <strong>simulation case study</strong>. 
                    This destination offers a unique blend of spiritual atmosphere, lush greenery, and Balinese tradition.
                </p>
                <div className="flex gap-4 pt-4">
                    <div className="p-4 bg-green-50 rounded-lg text-center w-1/3">
                        <div className="text-2xl">🌿</div>
                        <div className="font-bold text-gray-800 text-sm mt-2">Nature</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center w-1/3">
                        <div className="text-2xl">🐂</div>
                        <div className="font-bold text-gray-800 text-sm mt-2">Culture</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center w-1/3">
                        <div className="text-2xl">🔒</div>
                        <div className="font-bold text-gray-800 text-sm mt-2">Secure</div>
                    </div>
                </div>
            </div>
            <div className="h-[400px] bg-gray-200 rounded-2xl overflow-hidden shadow-2xl relative">
                 <img src="/about.jpg" alt="Lembu Putih View" className="w-full h-full object-cover hover:scale-110 transition duration-700"/>
            </div>
        </div>
      </section>

      {/* 4. BOOKING FORM */}
      <section ref={bookingSectionRef} className="py-24 bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Mint Your NFT Ticket</h2>
                <p className="text-gray-500">Connect wallet, select date, and secure your spot on the Blockchain.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-start">
                
                {/* Left: Status & Ticket List */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <p className="text-xs text-gray-400 uppercase font-bold mb-2">Tickets Available</p>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-5xl font-bold text-green-600">{maxSupply - totalMinted}</span>
                            <span className="text-xl text-gray-400 font-medium mb-2">/ {maxSupply} Available</span>
                        </div>
                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full" style={{ width: `${(totalMinted / maxSupply) * 100}%` }}></div>
                        </div>
                    </div>

                    {ticketCount > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200">
                            <h3 className="font-bold text-lg text-green-800 mb-4 flex items-center gap-2">
                                🎟️ Your Tickets ({ticketCount})
                            </h3>
                            <div className="max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                {myTokenIds.map((id) => (
                                    <div key={id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col gap-3">
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="font-mono font-bold text-lg text-gray-700">{formatVisualID(id)}</span>
                                            <button onClick={() => downloadTicketPDF(id)} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-black transition">
                                                Download PDF
                                            </button>
                                        </div>
                                        
                                        <div className="bg-green-50/50 p-2 rounded text-xs">
                                            <p className="font-semibold text-gray-500">Owner Address:</p>
                                            <p className="font-mono text-gray-700 break-all">{account}</p>
                                            <p className="text-[10px] text-gray-400 italic mt-1 leading-tight">
                                                *Public Address ditampilkan sebagai bukti transparansi kepemilikan aset (NFT).
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <a 
                                href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block w-full text-center py-3 mt-4 border-2 border-green-600 text-green-700 font-bold rounded-xl hover:bg-green-50 transition flex items-center justify-center gap-2"
                            >
                                <span>🔍</span> Check on Etherscan
                            </a>
                        </div>
                    )}
                </div> 

                {/* Right: Booking Form */}
                <div className="relative">
                    {!account && (
                        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl border border-gray-200">
                            <div className="bg-white p-6 rounded-xl shadow-2xl text-center max-w-xs">
                                <div className="text-4xl mb-3">🦊</div>
                                <h3 className="font-bold text-gray-900 mb-2">Wallet Locked</h3>
                                <button onClick={connectWallet} className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition">
                                    Connect MetaMask
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`bg-white p-8 rounded-2xl shadow-xl border border-gray-100 ${!account ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h3 className="font-bold text-xl mb-6">Booking Details</h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter visitor name" 
                                    value={visitorName} 
                                    onChange={(e) => setVisitorName(e.target.value)} 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-50 outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Visit Date</label>
                                <input 
                                    type="date" 
                                    min={getTodayDate()} 
                                    value={visitDate} 
                                    onChange={(e) => {
                                        setVisitDate(e.target.value);
                                        if (e.target.value < getTodayDate()) {
                                            setDateError("⚠️ Invalid date!");
                                        } else {
                                            setDateError("");
                                        }
                                    }} 
                                    className={`w-full p-3 bg-gray-50 border rounded-lg focus:ring-2 outline-none ${dateError ? 'border-red-500' : 'border-gray-200'}`}
                                />
                                {dateError && <p className="text-red-500 text-xs mt-2">{dateError}</p>}
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <span className="font-semibold text-gray-600">Ticket Qty</span>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setBuyQuantity(p => p > 1 ? p - 1 : 1)} className="w-8 h-8 rounded-full bg-white border hover:bg-gray-100 font-bold">-</button>
                                    <span className="font-bold text-lg">{buyQuantity}</span>
                                    <button onClick={() => setBuyQuantity(p => p + 1)} className="w-8 h-8 rounded-full bg-green-600 text-white shadow hover:bg-green-700 font-bold">+</button>
                                </div>
                            </div>

                            {/* --- BAGIAN TOTAL HARGA & TOMBOL PEMBAYARAN --- */}
                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <span className="text-gray-500 text-sm block">Total Price</span>
                                        {/* Indikator Harga Live */}
                                        <span className="text-[10px] text-blue-500 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 mt-1 inline-block">
                                            Live API Rate: 1 ETH = {formatToIDR("1")}
                                        </span>
                                    </div>
                                    
                                    <div className="text-right">
                                        {/* Harga Asli ETH */}
                                        <span className="text-3xl font-bold text-green-700 block">
                                            {(parseFloat(dynamicPrice) * buyQuantity).toFixed(4)} ETH
                                        </span>
                                        {/* Hasil Konversi ke Rupiah */}
                                        <span className="text-sm font-bold text-gray-500 block mt-1">
                                            ≈ {formatToIDR((parseFloat(dynamicPrice) * buyQuantity).toString())}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* --- DUAL PAYMENT BUTTONS --- */}
                                <div className="flex gap-3">
                                    <button 
                                        onClick={buyTicket} 
                                        disabled={loading || soldOut || !isSaleOn || !!dateError} 
                                        className="w-1/2 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                                    >
                                        <span>Pay with ETH</span>
                                        <span className="text-[10px] font-normal text-gray-300">(MetaMask)</span>
                                    </button>
                                    <button 
                                        onClick={buyWithRupiah} 
                                        disabled={loading || soldOut || !isSaleOn || !!dateError || !ethRateIDR} 
                                        className="w-1/2 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                                    >
                                        <span>Pay with Rupiah</span>
                                        <span className="text-[10px] font-normal text-blue-200">(QRIS/Transfer)</span>
                                    </button>
                                </div>
                                
                                {status && <p className="text-center text-sm mt-4 text-blue-600 font-medium bg-blue-50 py-2 rounded">{status}</p>}
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Footer Simple */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p>Copyright © 2026 Made Jauhari - Prototype TA.</p>
      </footer>
    </div>
  );
}
