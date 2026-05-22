require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Ini wajib ada untuk baca .env

module.exports = {
  solidity: "0.8.20", // Sesuaikan dengan versi solidity di file .sol Anda
  networks: {
    // Settingan untuk Localhost (Laptop)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Settingan untuk Internet (Sepolia)
    sepolia: {
      url: process.env.SEPOLIA_URL,      // Mengambil dari .env
      accounts: [process.env.PRIVATE_KEY] // Mengambil dari .env
    },
  },
};