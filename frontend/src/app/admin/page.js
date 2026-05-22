"use client";
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link'; 
import LembuPutihTicket from '@/utils/LembuPutihTicket.json';

// --- KONFIGURASI ---
const CONTRACT_ADDRESS = "0xb408739E4b1fFEAfF2DE0c9D2669ac530bc46dcb"; 

export default function AdminPage() {
  const [account, setAccount] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(""); 
  
  // Dashboard Data
  const [currentPrice, setCurrentPrice] = useState("0");
  const [currentQuota, setCurrentQuota] = useState("0");
  const [totalSold, setTotalSold] = useState("0");
  const [isSaleActive, setIsSaleActive] = useState(false);
  const [contractBalance, setContractBalance] = useState("0");

  // Inputs Config
  const [inputPrice, setInputPrice] = useState("");
  const [inputQuota, setInputQuota] = useState("");

  // Input Verifikasi
  const [verifyId, setVerifyId] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // --- FITUR BARU: SWITCH MATA UANG ---
  const [ethRateIDR, setEthRateIDR] = useState(0);
  const [isIdrMode, setIsIdrMode] = useState(false); // false = ETH mode, true = IDR mode

  // --- FUNGSI API: MENGAMBIL HARGA ETH KE IDR ---
  const fetchEthRate = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr');
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      if (data && data.ethereum && data.ethereum.idr) {
        setEthRateIDR(parseFloat(data.ethereum.idr));
      }
    } catch (error) {
      console.error("Gagal mengambil data konversi harga:", error);
    }
  };

  // --- HELPER FORMAT RUPIAH ---
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

  // --- HELPER PREVIEW KONVERSI SAAT INPUT ---
  const getPreviewConversion = () => {
    if (!inputPrice || !ethRateIDR) return null;
    
    if (isIdrMode) {
        // Konversi IDR yang diketik admin ke ETH
        const estimatedEth = parseFloat(inputPrice) / ethRateIDR;
        return `≈ ${estimatedEth.toFixed(6)} ETH`;
    } else {
        // Konversi ETH yang diketik admin ke IDR
        const estimatedIdr = parseFloat(inputPrice) * ethRateIDR;
        return `≈ ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(estimatedIdr)}`;
    }
  };

  // --- 1. CEK STATUS SAAT LOAD ---
  useEffect(() => { 
    const silentCheck = async () => {
        if (window.ethereum) {
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const accounts = await provider.listAccounts();
                if (accounts.length > 0) {
                    const signer = await provider.getSigner();
                    const address = await signer.getAddress();
                    setAccount(address);
                    
                    const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
                    const owner = await contract.owner();
                    if (owner.toLowerCase() === address.toLowerCase()) {
                        setIsOwner(true);
                        fetchContractData(provider);
                    }
                }
            } catch (err) { console.log(err); }
        }
    };
    silentCheck();
    fetchEthRate(); // Load exchange rate untuk admin
  }, []);

  // --- 2. LOGIKA LOGIN & VALIDASI ---
  const connectWallet = async () => {
    if (window.ethereum) {
      setErrorMsg(""); 
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(); 
        const address = await signer.getAddress();
        setAccount(address);
        
        const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
        const owner = await contract.owner();
        
        if (owner.toLowerCase() === address.toLowerCase()) {
            setIsOwner(true);
            fetchContractData(provider);
        } else {
            setIsOwner(false);
            setErrorMsg("Access Denied! Only Contract Owner can access this panel.");
            setTimeout(() => setErrorMsg(""), 3000); 
        }
      } catch (err) { 
        console.error(err);
      }
    } else {
        alert("Metamask not found!");
    }
  };

  const fetchContractData = async (provider) => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
    const price = await contract.ticketPrice();
    const active = await contract.isSaleActive();
    const max = await contract.maxSupply();
    const sold = await contract.totalMinted();
    const balance = await provider.getBalance(CONTRACT_ADDRESS);

    setCurrentPrice(ethers.formatEther(price));
    setIsSaleActive(active);
    setCurrentQuota(max.toString());
    setTotalSold(sold.toString());
    setContractBalance(ethers.formatEther(balance));
  };

  const updateConfig = async () => {
    if (!isOwner) return;
    setLoadingConfig(true);
    setStatusMsg("⏳ Saving configuration to Blockchain...");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);

      if (inputPrice) { 
        let finalEthValue = inputPrice;
        
        // JIKA ADMIN MENGGUNAKAN MODE IDR, KONVERSI DULU KE ETH
        if (isIdrMode) {
            if (!ethRateIDR) throw new Error("Exchange rate not loaded. Please wait.");
            const calculatedEth = parseFloat(inputPrice) / ethRateIDR;
            finalEthValue = calculatedEth.toFixed(18).replace(/\.?0+$/, ''); // Mencegah format e- notation
        }

        const tx = await contract.setPrice(ethers.parseEther(finalEthValue)); 
        await tx.wait(); 
      }
      
      if (inputQuota) { 
        const tx2 = await contract.setMaxSupply(inputQuota); 
        await tx2.wait(); 
      }

      setStatusMsg("✅ Configuration Saved Successfully!");
      fetchContractData(provider);
      setInputPrice("");
      setInputQuota("");
    } catch (err) { setStatusMsg("❌ Failed: " + err.message); }
    setLoadingConfig(false);
  };

  const toggleStatus = async () => {
    if (!isOwner) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);
      const tx = await contract.setSaleStatus(!isSaleActive);
      await tx.wait();
      fetchContractData(provider);
    } catch (err) { console.error(err); }
  };

  const withdrawFunds = async () => {
    if (!isOwner) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);
      const tx = await contract.withdraw();
      await tx.wait();
      setStatusMsg("✅ Funds Withdrawn to Owner Wallet!");
      fetchContractData(provider);
    } catch (err) { setStatusMsg("❌ Withdraw Failed"); }
  };

  const checkTicket = async () => {
    if (!verifyId) return;
    setVerifyResult(null);

    let rawInput = verifyId.trim();
    let tokenIdToVerify = rawInput;

    if (rawInput.toUpperCase().startsWith("LPT-")) {
        const parts = rawInput.split("-");
        const lastPart = parts[parts.length - 1];
        tokenIdToVerify = parseInt(lastPart).toString();
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
      
      const owner = await contract.ownerOf(tokenIdToVerify);
      const details = await contract.getTicketDetails(tokenIdToVerify);
      
      setVerifyResult({
        valid: true,
        scannedId: rawInput, 
        realId: tokenIdToVerify, 
        owner: owner,
        name: details[0],
        date: details[1]
      });
    } catch (err) {
      setVerifyResult({ valid: false });
    }
  };

  // --- TAMPILAN JIKA BELUM LOGIN ---
  if (!isOwner) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-sans">
        
        {/* BACKGROUND */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 scale-110 blur-md brightness-50" 
          style={{ backgroundImage: "url('/hero-bg.jpg')" }} 
        ></div>

        {/* POPUP ERROR */}
        {errorMsg && (
            <div className="absolute top-10 z-50 animate-bounce">
                <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold border-2 border-red-400">
                    <span>🚫</span> {errorMsg}
                </div>
            </div>
        )}

        <div className="relative z-10 bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-white/50">
            <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
                <span className="text-4xl">🛠️</span>
            </div>
            
            {/* [REVISI] Judul Sistem Umum */}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">BlockTix Admin</h1>
            <p className="text-gray-500 mb-8">
                System Control Panel. Restricted access for Contract Owner only.
            </p>

            <button 
                onClick={connectWallet}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all transform hover:scale-105 shadow-lg flex justify-center items-center gap-2"
            >
                <span>🦊</span> Connect Admin Wallet
            </button>

            <Link href="/" className="block mt-6 text-sm text-gray-500 hover:text-green-600 font-semibold">
                ← Back to User Site
            </Link>
        </div>
      </div>
    );
  }

  // --- TAMPILAN DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      
      {/* --- NAVBAR ADMIN --- */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg">
                    <span className="text-xl">🛠️</span>
                </div>
                <div>
                    {/* [REVISI] Judul Sistem Umum */}
                    <h1 className="text-lg font-bold text-gray-900 leading-none">BlockTix Admin</h1>
                    <p className="text-xs text-gray-500">System Control Panel</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <Link href="/" className="text-sm font-medium text-gray-500 hover:text-green-600 transition">
                    ← View Live Site
                 </Link>
                 <div className="px-4 py-2 rounded-full text-xs font-bold border bg-green-50 text-green-700 border-green-200">
                    ACCESS GRANTED
                 </div>
            </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 mt-10">
        
        <div className="grid md:grid-cols-12 gap-8">
            
            {/* --- LEFT COLUMN: CONTROLS (8 Cols) --- */}
            <div className="md:col-span-8 space-y-8">
                
                {/* 1. SALES CONFIGURATION */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Market Configuration</h2>
                            <p className="text-sm text-gray-500">Manage ticket pricing and supply.</p>
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-bold ${isSaleActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isSaleActive ? "● MARKET OPEN" : "● MARKET CLOSED"}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Price</label>
                            <p className="text-2xl font-bold text-gray-900">{currentPrice} <span className="text-sm text-gray-500">ETH</span></p>
                            {/* Tampilan Harga Rupiah Live */}
                            <p className="text-sm font-semibold text-blue-600 mt-1">≈ {formatToIDR(currentPrice)}</p>
                            
                            <div className="mt-3 text-[10px] bg-yellow-50 text-yellow-700 p-2 rounded border border-yellow-200 leading-tight">
                                ⚠ <strong>Testnet Mode:</strong> Using Native ETH.<br/>
                                <em>Stablecoin (IDRT) logic is disabled for this simulation.</em>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Supply</label>
                            <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-3xl font-bold text-gray-900">{currentQuota}</p>
                                <p className="text-sm text-gray-500">({totalSold} Sold)</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="block text-sm font-semibold text-gray-700">Update Price ({isIdrMode ? 'IDR' : 'ETH'})</label>
                                    
                                    {/* TOMBOL SWITCH CURRENCY */}
                                    <button 
                                        onClick={() => { setIsIdrMode(!isIdrMode); setInputPrice(""); }}
                                        className="text-xs font-bold px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
                                    >
                                        Switch to {isIdrMode ? 'ETH' : 'IDR'}
                                    </button>
                                </div>
                                <input 
                                    type="number" 
                                    step="any" 
                                    value={inputPrice} 
                                    onChange={e=>setInputPrice(e.target.value)} 
                                    placeholder={isIdrMode ? "e.g. 50000" : "e.g. 0.05"} 
                                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
                                />
                                {/* Preview Konversi di bawah input */}
                                {inputPrice && (
                                    <p className="text-xs text-gray-500 font-semibold mt-1 bg-gray-100 p-1 rounded inline-block">
                                        {getPreviewConversion()}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Update Quota</label>
                                <input type="number" value={inputQuota} onChange={e=>setInputQuota(e.target.value)} placeholder="e.g. 500" className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"/>
                            </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                            <button onClick={updateConfig} disabled={loadingConfig} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg">
                                {loadingConfig ? "Saving..." : "Save Changes"}
                            </button>
                            <button onClick={toggleStatus} className={`px-6 py-3 rounded-xl font-bold border transition ${isSaleActive ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
                                {isSaleActive ? "Close Market" : "Open Market"}
                            </button>
                        </div>
                        {statusMsg && <p className="text-center text-sm font-medium text-blue-600 bg-blue-50 py-2 rounded-lg">{statusMsg}</p>}
                    </div>
                </div>

                {/* 2. VERIFY TICKET */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Gate Verification</h2>
                    <p className="text-sm text-gray-500 mb-6">Scan or input Visitor Ticket ID to verify validity on Blockchain.</p>
                    
                    <div className="flex gap-3 mb-6">
                        <input 
                            type="text" 
                            value={verifyId} 
                            onChange={e=>setVerifyId(e.target.value)} 
                            placeholder="Enter Ticket ID (e.g. LPT-xxxx-0008)" 
                            className="flex-1 p-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono text-center text-lg uppercase tracking-wider"
                        />
                        <button onClick={checkTicket} className="px-8 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition shadow-lg">
                            VERIFY
                        </button>
                    </div>

                    {verifyResult && (
                        <div className={`p-6 rounded-xl border-2 ${verifyResult.valid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'} transition-all duration-300`}>
                            {verifyResult.valid ? (
                                <div className="flex items-start gap-5">
                                    <div className="bg-green-500 text-white p-3 rounded-full text-2xl">✓</div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-green-800">TICKET VALID</h3>
                                        <p className="text-sm text-green-600 mb-3">ID: {verifyResult.scannedId}</p>
                                        
                                        <div className="grid grid-cols-2 gap-4 bg-white/60 p-4 rounded-lg border border-green-100">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold">Visitor Name</p>
                                                <p className="text-lg font-bold text-gray-900">{verifyResult.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold">Visit Date</p>
                                                <p className="text-lg font-bold text-gray-900">{verifyResult.date}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <p className="text-xs text-gray-500 uppercase font-bold">Owner Wallet</p>
                                            <p className="text-xs font-mono text-gray-600 break-all">{verifyResult.owner}</p>
                                            <p className="text-[10px] text-gray-400 italic mt-1">*Address verified on public blockchain.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center">
                                    <div className="text-5xl mb-2">🚫</div>
                                    <h3 className="text-xl font-bold text-red-700">INVALID TICKET</h3>
                                    <p className="text-red-600">The ticket ID provided does not exist or is incorrect.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* --- RIGHT COLUMN: FINANCE (4 Cols) --- */}
            <div className="md:col-span-4 space-y-8">
                
                {/* FINANCIAL CARD */}
                <div className="bg-white text-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                    <div className="absolute -top-4 -right-1 p-4 text-gray-100 text-9xl font-serif select-none pointer-events-none">ETH</div>
                    <div className="relative z-10">
                        <p className="font-bold text-gray-900 mb-1 flex items-center gap-2">Total Revenue</p>
                        <h3 className="text-5xl font-bold text-green-500 mb-6">{contractBalance} <span className="text-lg text-green-500">ETH</span></h3>
                        
                        <button onClick={withdrawFunds} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-2">
                            <span>💸</span> Withdraw Funds
                        </button>
                        <p className="text-xs text-gray-500 text-center mt-3">Funds will be transferred to Owner Wallet</p>
                    </div>
                </div>

                {/* OWNER INFO */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        👤 Active Admin
                    </h3>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center text-xl">🛡️</div>
                        <div className="overflow-hidden">
                            <p className="text-xs text-gray-500">Connected Wallet</p>
                            <p className="text-sm font-bold font-mono text-gray-800 truncate w-40">{account}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                        <span>Network Status</span>
                        <span className="flex items-center gap-1 text-green-600 font-bold"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Online (Sepolia)</span>
                    </div>
                </div>

            </div>
          </div>
      </div>
    </div>
  );
}

// "use client";
// import { useState, useEffect } from 'react';
// import { ethers } from 'ethers';
// import Link from 'next/link'; 
// import LembuPutihTicket from '@/utils/LembuPutihTicket.json';

// // --- KONFIGURASI ---
// const CONTRACT_ADDRESS = "0xb408739E4b1fFEAfF2DE0c9D2669ac530bc46dcb"; 

// export default function AdminPage() {
//   const [account, setAccount] = useState("");
//   const [isOwner, setIsOwner] = useState(false);
//   const [statusMsg, setStatusMsg] = useState("");
//   const [errorMsg, setErrorMsg] = useState(""); 
  
//   // Dashboard Data
//   const [currentPrice, setCurrentPrice] = useState("0");
//   const [currentQuota, setCurrentQuota] = useState("0");
//   const [totalSold, setTotalSold] = useState("0");
//   const [isSaleActive, setIsSaleActive] = useState(false);
//   const [contractBalance, setContractBalance] = useState("0");

//   // Inputs Config
//   const [inputPrice, setInputPrice] = useState("");
//   const [inputQuota, setInputQuota] = useState("");

//   // Input Verifikasi
//   const [verifyId, setVerifyId] = useState("");
//   const [verifyResult, setVerifyResult] = useState(null);
//   const [loadingConfig, setLoadingConfig] = useState(false);
  
//   // State Deploy
//   const [isDeploying, setIsDeploying] = useState(false);

//   // --- FITUR BARU: SWITCH MATA UANG ---
//   const [ethRateIDR, setEthRateIDR] = useState(0);
//   const [isIdrMode, setIsIdrMode] = useState(false); 

//   // --- FUNGSI API: MENGAMBIL HARGA ETH KE IDR ---
//   const fetchEthRate = async () => {
//     try {
//       const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=idr');
//       if (!response.ok) throw new Error("Network response was not ok");
//       const data = await response.json();
//       if (data && data.ethereum && data.ethereum.idr) {
//         setEthRateIDR(parseFloat(data.ethereum.idr));
//       }
//     } catch (error) {
//       console.error("Gagal mengambil data konversi harga:", error);
//     }
//   };

//   // --- HELPER FORMAT RUPIAH ---
//   const formatToIDR = (ethAmount) => {
//     if (!ethRateIDR) return "Memuat harga...";
//     const totalIdr = parseFloat(ethAmount) * ethRateIDR;
//     return new Intl.NumberFormat("id-ID", {
//       style: "currency",
//       currency: "IDR",
//       minimumFractionDigits: 0,
//       maximumFractionDigits: 0,
//     }).format(totalIdr);
//   };

//   // --- HELPER PREVIEW KONVERSI SAAT INPUT ---
//   const getPreviewConversion = () => {
//     if (!inputPrice || !ethRateIDR) return null;
    
//     if (isIdrMode) {
//         const estimatedEth = parseFloat(inputPrice) / ethRateIDR;
//         return `≈ ${estimatedEth.toFixed(6)} ETH`;
//     } else {
//         const estimatedIdr = parseFloat(inputPrice) * ethRateIDR;
//         return `≈ ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(estimatedIdr)}`;
//     }
//   };

//   // --- 1. CEK STATUS SAAT LOAD ---
//   useEffect(() => { 
//     const silentCheck = async () => {
//         if (window.ethereum) {
//             try {
//                 const provider = new ethers.BrowserProvider(window.ethereum);
//                 const accounts = await provider.listAccounts();
//                 if (accounts.length > 0) {
//                     const signer = await provider.getSigner();
//                     const address = await signer.getAddress();
//                     setAccount(address);
                    
//                     const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
//                     const owner = await contract.owner();
//                     if (owner.toLowerCase() === address.toLowerCase()) {
//                         setIsOwner(true);
//                         fetchContractData(provider);
//                     }
//                 }
//             } catch (err) { console.log(err); }
//         }
//     };
//     silentCheck();
//     fetchEthRate(); 
//   }, []);

//   // --- 2. LOGIKA LOGIN & VALIDASI ---
//   const connectWallet = async () => {
//     if (window.ethereum) {
//       setErrorMsg(""); 
//       try {
//         const provider = new ethers.BrowserProvider(window.ethereum);
//         const signer = await provider.getSigner(); 
//         const address = await signer.getAddress();
//         setAccount(address);
        
//         const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
//         const owner = await contract.owner();
        
//         if (owner.toLowerCase() === address.toLowerCase()) {
//             setIsOwner(true);
//             fetchContractData(provider);
//         } else {
//             setIsOwner(false);
//             setErrorMsg("Access Denied! Only Contract Owner can access this panel.");
//             setTimeout(() => setErrorMsg(""), 3000); 
//         }
//       } catch (err) { 
//         console.error(err);
//       }
//     } else {
//         alert("Metamask not found!");
//     }
//   };

//   const fetchContractData = async (provider) => {
//     const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
//     const price = await contract.ticketPrice();
//     const active = await contract.isSaleActive();
//     const max = await contract.maxSupply();
//     const sold = await contract.totalMinted();
//     const balance = await provider.getBalance(CONTRACT_ADDRESS);

//     setCurrentPrice(ethers.formatEther(price));
//     setIsSaleActive(active);
//     setCurrentQuota(max.toString());
//     setTotalSold(sold.toString());
//     setContractBalance(ethers.formatEther(balance));
//   };

//   // --- 3. FUNGSI DEPLOY BARU DARI FRONTEND ---
//   const deployNewContract = async () => {
//     if (!window.ethereum) return alert("MetaMask not found!");
    
//     // Validasi pengecekan bytecode
//     if (!LembuPutihTicket.bytecode) {
//         return alert("Bytecode tidak ditemukan di file LembuPutihTicket.json! Pastikan Anda menyalin 'abi' dan 'bytecode' dari hasil kompilasi Hardhat.");
//     }

//     const confirmDeploy = confirm("Anda yakin ingin mendeploy ulang Smart Contract baru? Ini akan memakan Gas Fee.");
//     if (!confirmDeploy) return;

//     setIsDeploying(true);
//     setStatusMsg("🚀 Memulai proses deploy... Silakan konfirmasi di MetaMask.");

//     try {
//         const provider = new ethers.BrowserProvider(window.ethereum);
//         const signer = await provider.getSigner();

//         // Menggunakan ContractFactory dari ethers.js
//         const factory = new ethers.ContractFactory(
//             LembuPutihTicket.abi, 
//             LembuPutihTicket.bytecode, 
//             signer
//         );

//         // Eksekusi deploy
//         const contract = await factory.deploy();
        
//         setStatusMsg("⏳ Menunggu validasi block... (Jangan tutup halaman)");
//         await contract.waitForDeployment();
        
//         const newAddress = await contract.getAddress();
//         setStatusMsg(`✅ Berhasil! Contract Baru: ${newAddress}`);
        
//         alert(`DEPLOY SUKSES!\n\nAlamat Kontrak Baru Anda:\n${newAddress}\n\nSilakan copy alamat ini dan update variabel CONTRACT_ADDRESS di file kodingan Anda.`);
        
//     } catch (err) {
//         console.error(err);
//         setStatusMsg("❌ Deploy Gagal: " + (err.reason || err.message));
//     }
//     setIsDeploying(false);
//   };

//   const updateConfig = async () => {
//     if (!isOwner) return;
//     setLoadingConfig(true);
//     setStatusMsg("⏳ Saving configuration to Blockchain...");
//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const signer = await provider.getSigner();
//       const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);

//       if (inputPrice) { 
//         let finalEthValue = inputPrice;
//         if (isIdrMode) {
//             if (!ethRateIDR) throw new Error("Exchange rate not loaded. Please wait.");
//             const calculatedEth = parseFloat(inputPrice) / ethRateIDR;
//             finalEthValue = calculatedEth.toFixed(18).replace(/\.?0+$/, ''); 
//         }
//         const tx = await contract.setPrice(ethers.parseEther(finalEthValue)); 
//         await tx.wait(); 
//       }
      
//       if (inputQuota) { 
//         const tx2 = await contract.setMaxSupply(inputQuota); 
//         await tx2.wait(); 
//       }

//       setStatusMsg("✅ Configuration Saved Successfully!");
//       fetchContractData(provider);
//       setInputPrice("");
//       setInputQuota("");
//     } catch (err) { setStatusMsg("❌ Failed: " + err.message); }
//     setLoadingConfig(false);
//   };

//   const toggleStatus = async () => {
//     if (!isOwner) return;
//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const signer = await provider.getSigner();
//       const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);
//       const tx = await contract.setSaleStatus(!isSaleActive);
//       await tx.wait();
//       fetchContractData(provider);
//     } catch (err) { console.error(err); }
//   };

//   const withdrawFunds = async () => {
//     if (!isOwner) return;
//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const signer = await provider.getSigner();
//       const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, signer);
//       const tx = await contract.withdraw();
//       await tx.wait();
//       setStatusMsg("✅ Funds Withdrawn to Owner Wallet!");
//       fetchContractData(provider);
//     } catch (err) { setStatusMsg("❌ Withdraw Failed"); }
//   };

//   const checkTicket = async () => {
//     if (!verifyId) return;
//     setVerifyResult(null);

//     let rawInput = verifyId.trim();
//     let tokenIdToVerify = rawInput;

//     if (rawInput.toUpperCase().startsWith("LPT-")) {
//         const parts = rawInput.split("-");
//         const lastPart = parts[parts.length - 1];
//         tokenIdToVerify = parseInt(lastPart).toString();
//     }

//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const contract = new ethers.Contract(CONTRACT_ADDRESS, LembuPutihTicket.abi, provider);
      
//       const owner = await contract.ownerOf(tokenIdToVerify);
//       const details = await contract.getTicketDetails(tokenIdToVerify);
      
//       setVerifyResult({
//         valid: true,
//         scannedId: rawInput, 
//         realId: tokenIdToVerify, 
//         owner: owner,
//         name: details[0],
//         date: details[1]
//       });
//     } catch (err) {
//       setVerifyResult({ valid: false });
//     }
//   };

//   // --- TAMPILAN JIKA BELUM LOGIN ---
//   if (!isOwner) {
//     return (
//       <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden font-sans">
        
//         {/* BACKGROUND */}
//         <div 
//           className="absolute inset-0 bg-cover bg-center z-0 scale-110 blur-md brightness-50" 
//           style={{ backgroundImage: "url('/hero-bg.jpg')" }} 
//         ></div>

//         {/* POPUP ERROR */}
//         {errorMsg && (
//             <div className="absolute top-10 z-50 animate-bounce">
//                 <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold border-2 border-red-400">
//                     <span>🚫</span> {errorMsg}
//                 </div>
//             </div>
//         )}

//         <div className="relative z-10 bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-white/50">
//             <div className="bg-gray-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
//                 <span className="text-4xl">🛠️</span>
//             </div>
            
//             <h1 className="text-3xl font-bold text-gray-900 mb-2">BlockTix Admin</h1>
//             <p className="text-gray-500 mb-8">
//                 System Control Panel. Restricted access for Contract Owner only.
//             </p>

//             <button 
//                 onClick={connectWallet}
//                 className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all transform hover:scale-105 shadow-lg flex justify-center items-center gap-2"
//             >
//                 <span>🦊</span> Connect Admin Wallet
//             </button>

//             <Link href="/" className="block mt-6 text-sm text-gray-500 hover:text-green-600 font-semibold">
//                 ← Back to User Site
//             </Link>
//         </div>
//       </div>
//     );
//   }

//   // --- TAMPILAN DASHBOARD ---
//   return (
//     <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      
//       {/* --- NAVBAR ADMIN --- */}
//       <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
//         <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
//             <div className="flex items-center gap-3">
//                 <div className="bg-gray-900 text-white p-2 rounded-lg shadow-lg">
//                     <span className="text-xl">🛠️</span>
//                 </div>
//                 <div>
//                     <h1 className="text-lg font-bold text-gray-900 leading-none">BlockTix Admin</h1>
//                     <p className="text-xs text-gray-500">System Control Panel</p>
//                 </div>
//             </div>
//             <div className="flex items-center gap-4">
//                  <Link href="/" className="text-sm font-medium text-gray-500 hover:text-green-600 transition">
//                     ← View Live Site
//                  </Link>
//                  <div className="px-4 py-2 rounded-full text-xs font-bold border bg-green-50 text-green-700 border-green-200">
//                     ACCESS GRANTED
//                  </div>
//             </div>
//         </div>
//       </nav>

//       <div className="max-w-6xl mx-auto px-6 mt-10">
//         <div className="grid md:grid-cols-12 gap-8">
            
//             {/* --- LEFT COLUMN: CONTROLS (8 Cols) --- */}
//             <div className="md:col-span-8 space-y-8">
                
//                 {/* 1. SALES CONFIGURATION */}
//                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
//                     <div className="flex justify-between items-start mb-6">
//                         <div>
//                             <h2 className="text-xl font-bold text-gray-900">Market Configuration</h2>
//                             <p className="text-sm text-gray-500">Manage ticket pricing and supply.</p>
//                         </div>
//                         <div className={`px-3 py-1 rounded text-xs font-bold ${isSaleActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
//                             {isSaleActive ? "● MARKET OPEN" : "● MARKET CLOSED"}
//                         </div>
//                     </div>

//                     <div className="grid grid-cols-2 gap-6 mb-6">
//                         <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
//                             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Price</label>
//                             <p className="text-2xl font-bold text-gray-900">{currentPrice} <span className="text-sm text-gray-500">ETH</span></p>
//                             <p className="text-sm font-semibold text-blue-600 mt-1">≈ {formatToIDR(currentPrice)}</p>
                            
//                             <div className="mt-3 text-[10px] bg-yellow-50 text-yellow-700 p-2 rounded border border-yellow-200 leading-tight">
//                                 ⚠ <strong>Testnet Mode:</strong> Using Native ETH.<br/>
//                                 <em>Stablecoin (IDRT) logic is disabled for this simulation.</em>
//                             </div>
//                         </div>
//                         <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
//                             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Supply</label>
//                             <div className="flex items-baseline gap-2 mt-1">
//                                 <p className="text-3xl font-bold text-gray-900">{currentQuota}</p>
//                                 <p className="text-sm text-gray-500">({totalSold} Sold)</p>
//                             </div>
//                         </div>
//                     </div>

//                     <div className="space-y-4 pt-4 border-t border-gray-100">
//                         <div className="grid grid-cols-2 gap-4">
//                             <div>
//                                 <div className="flex justify-between items-end mb-1">
//                                     <label className="block text-sm font-semibold text-gray-700">Update Price ({isIdrMode ? 'IDR' : 'ETH'})</label>
//                                     <button 
//                                         onClick={() => { setIsIdrMode(!isIdrMode); setInputPrice(""); }}
//                                         className="text-xs font-bold px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
//                                     >
//                                         Switch to {isIdrMode ? 'ETH' : 'IDR'}
//                                     </button>
//                                 </div>
//                                 <input 
//                                     type="number" 
//                                     step="any" 
//                                     value={inputPrice} 
//                                     onChange={e=>setInputPrice(e.target.value)} 
//                                     placeholder={isIdrMode ? "e.g. 50000" : "e.g. 0.05"} 
//                                     className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
//                                 />
//                                 {inputPrice && (
//                                     <p className="text-xs text-gray-500 font-semibold mt-1 bg-gray-100 p-1 rounded inline-block">
//                                         {getPreviewConversion()}
//                                     </p>
//                                 )}
//                             </div>
//                             <div>
//                                 <label className="block text-sm font-semibold text-gray-700 mb-1">Update Quota</label>
//                                 <input type="number" value={inputQuota} onChange={e=>setInputQuota(e.target.value)} placeholder="e.g. 500" className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"/>
//                             </div>
//                         </div>
//                         <div className="flex gap-4 pt-2">
//                             <button onClick={updateConfig} disabled={loadingConfig} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg">
//                                 {loadingConfig ? "Saving..." : "Save Changes"}
//                             </button>
//                             <button onClick={toggleStatus} className={`px-6 py-3 rounded-xl font-bold border transition ${isSaleActive ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
//                                 {isSaleActive ? "Close Market" : "Open Market"}
//                             </button>
//                         </div>
//                         {statusMsg && <p className="text-center text-sm font-medium text-blue-600 bg-blue-50 py-2 rounded-lg">{statusMsg}</p>}
//                     </div>
//                 </div>

//                 {/* 2. VERIFY TICKET */}
//                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
//                     <h2 className="text-xl font-bold text-gray-900 mb-2">Gate Verification</h2>
//                     <p className="text-sm text-gray-500 mb-6">Scan or input Visitor Ticket ID to verify validity on Blockchain.</p>
                    
//                     <div className="flex gap-3 mb-6">
//                         <input 
//                             type="text" 
//                             value={verifyId} 
//                             onChange={e=>setVerifyId(e.target.value)} 
//                             placeholder="Enter Ticket ID (e.g. LPT-xxxx-0008)" 
//                             className="flex-1 p-4 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono text-center text-lg uppercase tracking-wider"
//                         />
//                         <button onClick={checkTicket} className="px-8 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition shadow-lg">
//                             VERIFY
//                         </button>
//                     </div>

//                     {verifyResult && (
//                         <div className={`p-6 rounded-xl border-2 ${verifyResult.valid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'} transition-all duration-300`}>
//                             {verifyResult.valid ? (
//                                 <div className="flex items-start gap-5">
//                                     <div className="bg-green-500 text-white p-3 rounded-full text-2xl">✓</div>
//                                     <div className="flex-1">
//                                         <h3 className="text-xl font-bold text-green-800">TICKET VALID</h3>
//                                         <p className="text-sm text-green-600 mb-3">ID: {verifyResult.scannedId}</p>
                                        
//                                         <div className="grid grid-cols-2 gap-4 bg-white/60 p-4 rounded-lg border border-green-100">
//                                             <div>
//                                                 <p className="text-xs text-gray-500 uppercase font-bold">Visitor Name</p>
//                                                 <p className="text-lg font-bold text-gray-900">{verifyResult.name}</p>
//                                             </div>
//                                             <div>
//                                                 <p className="text-xs text-gray-500 uppercase font-bold">Visit Date</p>
//                                                 <p className="text-lg font-bold text-gray-900">{verifyResult.date}</p>
//                                             </div>
//                                         </div>
//                                         <div className="mt-3">
//                                             <p className="text-xs text-gray-500 uppercase font-bold">Owner Wallet</p>
//                                             <p className="text-xs font-mono text-gray-600 break-all">{verifyResult.owner}</p>
//                                             <p className="text-[10px] text-gray-400 italic mt-1">*Address verified on public blockchain.</p>
//                                         </div>
//                                     </div>
//                                 </div>
//                             ) : (
//                                 <div className="flex flex-col items-center text-center">
//                                     <div className="text-5xl mb-2">🚫</div>
//                                     <h3 className="text-xl font-bold text-red-700">INVALID TICKET</h3>
//                                     <p className="text-red-600">The ticket ID provided does not exist or is incorrect.</p>
//                                 </div>
//                             )}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {/* --- RIGHT COLUMN: FINANCE & UTILS (4 Cols) --- */}
//             <div className="md:col-span-4 space-y-8">
                
//                 {/* FINANCIAL CARD */}
//                 <div className="bg-white text-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
//                     <div className="absolute -top-4 -right-1 p-4 text-gray-100 text-9xl font-serif select-none pointer-events-none">ETH</div>
//                     <div className="relative z-10">
//                         <p className="font-bold text-gray-900 mb-1 flex items-center gap-2">Total Revenue</p>
//                         <h3 className="text-5xl font-bold text-green-500 mb-6">{contractBalance} <span className="text-lg text-green-500">ETH</span></h3>
                        
//                         <button onClick={withdrawFunds} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-2">
//                             <span>💸</span> Withdraw Funds
//                         </button>
//                         <p className="text-xs text-gray-500 text-center mt-3">Funds will be transferred to Owner Wallet</p>
//                     </div>
//                 </div>

//                 {/* OWNER INFO */}
//                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
//                     <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
//                         👤 Active Admin
//                     </h3>
//                     <div className="flex items-center gap-3 mb-2">
//                         <div className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center text-xl">🛡️</div>
//                         <div className="overflow-hidden">
//                             <p className="text-xs text-gray-500">Connected Wallet</p>
//                             <p className="text-sm font-bold font-mono text-gray-800 truncate w-40">{account}</p>
//                         </div>
//                     </div>
//                     <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
//                         <span>Network Status</span>
//                         <span className="flex items-center gap-1 text-green-600 font-bold"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Online (Sepolia)</span>
//                     </div>
//                 </div>

//                 {/* --- FITUR DEPLOY --- */}
//                 <div className="bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-800 text-white">
//                     <h3 className="font-bold mb-2 flex items-center gap-2">
//                         <span>🚀</span> Deploy Contract
//                     </h3>
//                     <p className="text-xs text-gray-400 mb-4">
//                         Launch a new instance of LembuPutihTicket to the Blockchain directly from browser.
//                     </p>
//                     <button 
//                         onClick={deployNewContract} 
//                         disabled={isDeploying}
//                         className="w-full py-3 bg-white text-gray-900 hover:bg-gray-200 font-bold rounded-xl transition shadow-lg disabled:opacity-50"
//                     >
//                         {isDeploying ? "Deploying..." : "Deploy New Contract"}
//                     </button>
//                 </div>

//             </div>
//           </div>
//       </div>
//     </div>
//   );
// }