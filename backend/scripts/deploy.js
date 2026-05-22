const hre = require("hardhat");

async function main() {
  // Mengambil referensi smart contract yang sudah dikompilasi
  const Ticket = await hre.ethers.getContractFactory("LembuPutihTicket");
  
  console.log("Sedang mendeploy smart contract, mohon tunggu...");
  
  // Melakukan deployment
  const ticket = await Ticket.deploy(); 

  // Menunggu hingga proses selesai
  await ticket.waitForDeployment();

  // Menampilkan alamat kontrak (PENTING untuk Frontend nanti)
  console.log("Smart Contract berhasil dideploy ke alamat:", await ticket.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});