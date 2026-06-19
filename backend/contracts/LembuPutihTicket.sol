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
    
    // --- VARIABEL KUOTA HARIAN ---
    uint256 public dailyQuota;     
    
    // STRUKTUR DATA PENGUNJUNG
    struct TicketData {
        string visitorName;
        string visitDate;
    }

    // Mapping: Token ID => Data Pengunjung
    mapping(uint256 => TicketData) public tickets;

    // --- MAPPING KUOTA HARIAN ---
    // Mapping: Tanggal Kunjungan (String) => Jumlah Tiket Terjual pada tanggal tersebut
    mapping(string => uint256) public ticketsSoldPerDate;

    event TicketMinted(address recipient, uint256 tokenId, string name, string date);

    constructor() ERC721("LembuPutihTicket", "LPT") Ownable(msg.sender) {
        ticketPrice = 0.01 ether; // Harga Testnet (SepoliaETH)
        isSaleActive = true;
        maxSupply = 10000;        // Misalnya total suplai diatur besar
        dailyQuota = 100;         // Default kuota harian = 100 tiket/hari
    }

    // --- ADMIN FUNCTIONS ---
    function setPrice(uint256 _newPrice) public onlyOwner { ticketPrice = _newPrice; }
    function setSaleStatus(bool _status) public onlyOwner { isSaleActive = _status; }
    function setMaxSupply(uint256 _newMax) public onlyOwner { maxSupply = _newMax; }
    
    // --- [REVISI PENGUJI 3]: FUNGSI UPDATE KUOTA HARIAN ---
    function setDailyQuota(uint256 _newQuota) public onlyOwner { dailyQuota = _newQuota; }

    function withdraw() public onlyOwner {
        require(address(this).balance > 0, "Saldo kosong");
        payable(owner()).transfer(address(this).balance);
    }

    // --- USER FUNCTION: BELI DENGAN DATA (VERSI TESTNET / SEPOLIA ETH) ---
    function buyTicket(uint256 quantity, string memory tokenURI, string memory _name, string memory _date) public payable {
        require(isSaleActive, "Sales HAVE CLOSED");
        require(totalMinted + quantity <= maxSupply, "Total quota EXHAUSTED");
        require(quantity > 0, "At least 1 ticket");
        require(msg.value >= ticketPrice * quantity, "Insufficient funds"); 
        require(bytes(_name).length > 0, "Name is required");
        require(bytes(_date).length > 0, "Date is required");

        // --- LOGIKA VALIDASI KUOTA HARIAN ---
        require(ticketsSoldPerDate[_date] + quantity <= dailyQuota, "The daily quota for this date is EXHAUSTED");

        // Tambahkan jumlah tiket terjual pada tanggal tersebut
        ticketsSoldPerDate[_date] += quantity;

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

    // --- FITUR BARU FIAT ON-RAMP (INTEGRASI MIDTRANS) ---
    function adminMint(address recipient, uint256 quantity, string memory tokenURI, string memory _name, string memory _date) public onlyOwner {
        require(isSaleActive, "Sales are CLOSED");
        require(totalMinted + quantity <= maxSupply, "The total quota is EXHAUSTED");
        require(quantity > 0, "At least 1 ticket");
        require(bytes(_name).length > 0, "Name is required");
        require(bytes(_date).length > 0, "Date is required");

        // --- [REVISI PENGUJI 3]: LOGIKA VALIDASI KUOTA HARIAN ---
        require(ticketsSoldPerDate[_date] + quantity <= dailyQuota, "The daily quota for this date is EXHAUSTED");

        // Tambahkan jumlah tiket terjual pada tanggal tersebut
        ticketsSoldPerDate[_date] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            _tokenIds++;
            totalMinted++;
            uint256 newItemId = _tokenIds;
            
            _mint(recipient, newItemId);
            _setTokenURI(newItemId, tokenURI);
            
            tickets[newItemId] = TicketData(_name, _date);

            emit TicketMinted(recipient, newItemId, _name, _date);
        }
    }

    // --- VIEW FUNCTIONS ---
    function getTicketDetails(uint256 tokenId) public view returns (string memory, string memory) {
        TicketData memory data = tickets[tokenId];
        return (data.visitorName, data.visitDate);
    }

    // --- [REVISI PENGUJI 3]: CEK SISA KUOTA HARIAN ---
    // Fungsi ini dipanggil frontend Next.js untuk mengecek sisa tiket di tanggal tertentu
    function getRemainingDailyQuota(string memory _date) public view returns (uint256) {
        if (ticketsSoldPerDate[_date] >= dailyQuota) {
            return 0;
        }
        return dailyQuota - ticketsSoldPerDate[_date];
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