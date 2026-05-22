// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// [UPDATE]: Import Interface ERC20 untuk persiapan pembayaran Stablecoin (IDRT/USDT) nanti
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LembuPutihTicket is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    
    // Config Admin
    uint256 public ticketPrice;
    bool public isSaleActive;
    uint256 public maxSupply;
    uint256 public totalMinted;

    // STRUKTUR DATA PENGUNJUNG
    struct TicketData {
        string visitorName;
        string visitDate;
    }

    // Mapping: Token ID => Data Pengunjung
    mapping(uint256 => TicketData) public tickets;

    event TicketMinted(address recipient, uint256 tokenId, string name, string date);

    constructor() ERC721("LembuPutihTicket", "LPT") Ownable(msg.sender) {
        ticketPrice = 0.01 ether; // Harga Testnet (SepoliaETH)
        isSaleActive = true;
        maxSupply = 100;
    }

    // --- ADMIN FUNCTIONS ---
    function setPrice(uint256 _newPrice) public onlyOwner { ticketPrice = _newPrice; }
    function setSaleStatus(bool _status) public onlyOwner { isSaleActive = _status; }
    function setMaxSupply(uint256 _newQuota) public onlyOwner { maxSupply = _newQuota; }

    function withdraw() public onlyOwner {
        require(address(this).balance > 0, "Saldo kosong");
        payable(owner()).transfer(address(this).balance);
    }

    // --- USER FUNCTION: BELI DENGAN DATA (VERSI TESTNET / SEPOLIA ETH) ---
    // Fungsi ini digunakan saat beli pakai MetaMask langsung (bayar ETH)
    function buyTicket(uint256 quantity, string memory tokenURI, string memory _name, string memory _date) public payable {
        require(isSaleActive, "Penjualan DITUTUP");
        require(totalMinted + quantity <= maxSupply, "Kuota HABIS");
        require(quantity > 0, "Minimal 1 tiket");
        require(msg.value >= ticketPrice * quantity, "Dana kurang"); // Bayar pakai ETH
        require(bytes(_name).length > 0, "Nama wajib diisi");
        require(bytes(_date).length > 0, "Tanggal wajib diisi");

        for (uint256 i = 0; i < quantity; i++) {
            _tokenIds++;
            totalMinted++;
            uint256 newItemId = _tokenIds;
            
            _mint(msg.sender, newItemId);
            _setTokenURI(newItemId, tokenURI);
            
            // SIMPAN NAMA & TANGGAL KE BLOCKCHAIN
            tickets[newItemId] = TicketData(_name, _date);

            emit TicketMinted(msg.sender, newItemId, _name, _date);
        }
    }

    // --- FITUR BARU: FIAT ON-RAMP (INTEGRASI MIDTRANS) ---
    // Fungsi ini dipanggil oleh Backend Server setelah Midtrans mendeteksi pembayaran Rupiah sukses.
    // Diberi akses 'onlyOwner' agar hanya Server (Admin) yang bisa mencetak tiket gratis ini untuk pengunjung.
    function adminMint(address recipient, uint256 quantity, string memory tokenURI, string memory _name, string memory _date) public onlyOwner {
        require(isSaleActive, "Penjualan DITUTUP");
        require(totalMinted + quantity <= maxSupply, "Kuota HABIS");
        require(quantity > 0, "Minimal 1 tiket");
        require(bytes(_name).length > 0, "Nama wajib diisi");
        require(bytes(_date).length > 0, "Tanggal wajib diisi");

        for (uint256 i = 0; i < quantity; i++) {
            _tokenIds++;
            totalMinted++;
            uint256 newItemId = _tokenIds;
            
            // _mint dikirim ke alamat 'recipient' (dompet pengunjung), BUKAN msg.sender (admin)
            _mint(recipient, newItemId);
            _setTokenURI(newItemId, tokenURI);
            
            // SIMPAN NAMA & TANGGAL KE BLOCKCHAIN
            tickets[newItemId] = TicketData(_name, _date);

            emit TicketMinted(recipient, newItemId, _name, _date);
        }
    }

    // --- [UPDATE]: SKENARIO IMPLEMENTASI MAINNET (FUTURE PLAN) ---
    /*
    function buyTicketWithStablecoin(uint256 quantity, string memory tokenURI, string memory _name, string memory _date, address tokenAddress) public {
        require(isSaleActive, "Penjualan DITUTUP");
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), ticketPriceStable * quantity);

        for (uint256 i = 0; i < quantity; i++) {
            _tokenIds++;
            totalMinted++;
            uint256 newItemId = _tokenIds;
            
            _mint(msg.sender, newItemId);
            _setTokenURI(newItemId, tokenURI);
            tickets[newItemId] = TicketData(_name, _date);
            emit TicketMinted(msg.sender, newItemId, _name, _date);
        }
    }
    */

    // --- VIEW FUNCTIONS ---
    function getTicketDetails(uint256 tokenId) public view returns (string memory, string memory) {
        TicketData memory data = tickets[tokenId];
        return (data.visitorName, data.visitDate);
    }

    function getWalletTickets(address _user) public view returns (uint256[] memory) {
        uint256 ownerBalance = balanceOf(_user);
        uint256[] memory ownedTokenIds = new uint256[](ownerBalance);
        uint256 currentTokenId = 1;
        uint256 ownedTokenIndex = 0;

        while (ownedTokenIndex < ownerBalance && currentTokenId <= _tokenIds) {
            if (ownerOf(currentTokenId) == _user) {
                ownedTokenIds[ownedTokenIndex] = currentTokenId;
                ownedTokenIndex++;
            }
            currentTokenId++;
        }
        return ownedTokenIds;
    }
}