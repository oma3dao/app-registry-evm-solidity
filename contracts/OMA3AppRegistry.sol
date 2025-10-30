// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./OMA3MetadataKeys.sol";

// Interface for ownership resolver
interface IOMA3OwnershipResolver {
    function currentOwner(bytes32 didHash) external view returns (address);
}

// Interface for data URL attestation resolver
interface IOMA3DataUrlResolver {
    function checkDataHashAttestation(
        bytes32 didHash,
        bytes32 dataHash
    ) external view returns (bool);
}

// Interface for registration resolver
interface IOMA3RegistrationResolver {
    struct RegistrationStoredParams {
        string didString;
        uint16 interfaces;
        string tokenURI;
        bytes32 dataHash;
        uint8 dataHashAlgorithm;
        string fungibleTokenId;
        string contractId;
        uint8 initialVersionMajor;
        uint8 initialVersionMinor;
        uint8 initialVersionPatch;
        bytes32[] traitHashes;
        string metadataJson;
        uint64 expiresAt;
        bool exists;
    }

    function loadAndConsumeRegister(
        address user,
        string memory tokenURI
    ) external returns (RegistrationStoredParams memory);
}

// Interface for metadata contract
interface IOMA3AppMetadata {
    function setMetadataForRegistry(
        string memory did,
        uint8 major,
        uint8 minor,
        uint8 patch,
        string memory metadataJson
    ) external;
}


/**
 * @title OMA3AppRegistry
 * @dev Registry for OMA3 applications using ERC721 tokens with enumeration
 * @notice Implements ERC-8004 Identity Registry functions for ecosystem compatibility
 */
contract OMA3AppRegistry is ERC721Enumerable, Ownable, ReentrancyGuard {

    // Version struct for efficient storage and comparison
    struct Version {
        uint8 major;
        uint8 minor;
        uint8 patch;
    }

    // App struct optimized for gas efficiency
    // Immutable fields: minter, versionMajor, did, fungibleTokenId, contractId
    // Mutable fields: interfaces, status, dataHashAlgorithm, dataHash, dataUrl, versionHistory, traitHashes
    struct App {
        // Slot 1 (32 bytes)
        address minter;                // 20 bytes - Original creator/minter (immutable)
        uint16 interfaces;             // 2 bytes - Interface bitmap (0=human, 2=api, 4=smart contract. Can combine) (mutable)
        uint8 versionMajor;            // 1 byte - Major version number of this NFT (immutable)
        uint8 status;                  // 1 byte - Status (0=active, 1=deprecated, 2=replaced)
        uint8 dataHashAlgorithm;       // 1 byte - Hash algorithm (0=keccak256, 1=sha256)
        // 7 bytes padding
        
        bytes32 dataHash;              // 32 bytes - Hash of JSON data
        
        // Dynamic fields (separate slots)
        string did;                    // DID as string (immutable)
        string fungibleTokenId;        // CAIP-19 token ID (immutable)
        string contractId;             // CAIP-10 contract address (immutable)
        string dataUrl;                // URL to off-chain data
        Version[] versionHistory;      // Array of version structs
        bytes32[] traitHashes;         // Array of trait hashes
    }

    // Custom errors for gas efficiency
    error DIDCannotBeEmpty();                      // DID string cannot be empty
    error DIDTooLong(uint256 length);             // DID exceeds MAX_DID_LENGTH
    error InvalidDataHashAlgorithm(uint8 algorithm); // Unsupported hash algorithm value
    error InterfacesCannotBeEmpty();              // Interface bitmap cannot be 0
    error DataUrlTooLong(uint256 length);         // Data URL exceeds MAX_URL_LENGTH
    error DataUrlCannotBeEmpty();                 // Data URL cannot be empty
    error FungibleTokenIdTooLong(uint256 length); // Fungible token ID exceeds MAX_URL_LENGTH
    error ContractIdTooLong(uint256 length);      // Contract ID exceeds MAX_URL_LENGTH
    error TooManyTraits(uint256 count);           // Trait array exceeds MAX_TRAITS limit
    error AppNotFound(string did, uint8 major);   // No app found for the given DID and major version
    error NotAppOwner(string did, uint8 major);   // Caller is not the owner of this app version
    error InvalidVersion(uint8 major, uint8 minor, uint8 patch); // Attempted to add a version that is not higher than the last
    error MajorVersionChangeRequiresNewMint(string did, uint8 currentMajor, uint8 attemptedMajor); // Major version changes require minting a new NFT
    error DIDMajorAlreadyExists(string did, uint8 major); // This (DID, major) tuple already exists
    error NewDIDRequired(string reason);         // Need new DID for this change
    error MinorIncrementRequired(uint8 currentMinor, uint8 attemptedMinor); // Interface changes require minor version increment
    error PatchIncrementRequired(uint8 currentPatch, uint8 attemptedPatch); // Data changes require patch version increment (unless minor++)
    error InterfaceRemovalNotAllowed(uint16 current, uint16 attempted); // Interface changes must be additive only
    error NoChangesSpecified();                  // No changes detected in update call
    error DIDHashNotFound(bytes32 didHash);     // No app found for the given DID hash
    error DataHashRequiredForTraitChange();     // New data hash required when updating traits
    error DataHashMismatch(bytes32 computed, bytes32 provided); // Computed hash doesn't match provided dataHash
    
    // ERC-8004 required errors
    error InvalidAgent(uint256 tokenId);        // Invalid or non-existent agent token
    error MetadataUnavailable(uint256 tokenId, string key); // Metadata key not available for this token


    // Storage
    // Inherited ERC721 storage:
    // - mapping(uint256 => address) _owners;              // tokenId => current owner
    // - mapping(address => uint256) _balances;            // owner => token count  
    // - mapping(uint256 => address) _tokenApprovals;      // tokenId => approved address
    // - mapping(address => mapping(address => bool)) _operatorApprovals; // owner => operator approvals
    
    // Our custom storage:
    mapping(uint256 => App) private _apps; // tokenId => App data
    mapping(bytes32 => mapping(uint8 => uint256)) private _didMajorToToken; // DID hash + major version => token ID
    mapping(bytes32 => string) private _didToFungibleTokenId; // DID hash => fungible token ID (for consistency validation)
    mapping(bytes32 => uint8) private _didToLatestMajor; // DID hash => highest major version (for O(1) lookup)
    mapping(bytes32 => bool) private _didExists; // DID hash => exists flag (to handle version 0.x.x)
    // Note: _ownerToTokenIds removed - using ERC721Enumerable's tokenOfOwnerByIndex instead

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // STORAGE MAPPINGS FOR EFFICIENT QUERIES
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    
    // Active app indexing for efficient queries (optimizes the common case)
    uint256[] private _activeTokenIds; // Array of active app token IDs
    mapping(uint256 => uint256) private _activeTokenIdToIndex; // tokenId => index in _activeTokenIds array

    // Registration tracking for bounded event log queries
    mapping(bytes32 => uint256) public registrationBlock; // DID hash => block number when first registered
    mapping(bytes32 => uint256) public registrationTimestamp; // DID hash => timestamp when first registered

    // Metadata contract integration
    IOMA3AppMetadata public metadataContract;

    // Resolvers for ownership and data validation
    IOMA3OwnershipResolver public ownershipResolver;
    IOMA3DataUrlResolver public dataUrlResolver;
    IOMA3RegistrationResolver public registrationResolver;

    // Feature flags
    bool public requireDataUrlAttestation; // Default: false (disabled)


    // Constants
    uint256 private constant MAX_DID_LENGTH = 128;
    uint256 private constant MAX_URL_LENGTH = 256;
    uint256 private constant MAX_TRAITS = 20;
    uint256 private constant MAX_APPS_PER_PAGE = 100; // Maximum apps to return per query

    // Token ID counter
    // Note: OpenZeppelin ERC721 does not include totalSupply tracking
    // (ERC721Enumerable extension would add this but with higher gas costs)
    uint256 private _totalTokens; // Our custom counter for sequential token IDs and total supply

    // ERC-8004 MetadataEntry struct
    struct MetadataEntry {
        string key;
        bytes value;
    }

    // Events (indexed by didHash + major + tokenId for both DID-based and NFT ecosystem compatibility)
    // Note: For cross-chain DID resolution, use the canonical OMA3 deduplicator on OMAChain
    event StatusUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint8 newStatus, uint256 timestamp);
    event DataUrlUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, string newDataUrl, bytes32 newDataHash, uint8 dataHashAlgorithm);
    event VersionAdded(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint8 minor, uint8 patch);
    event TraitsUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, bytes32[] newTraitHashes);
    event InterfacesUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint16 newInterfaces);
    
    // ERC-8004 compliant Registered event (replaces AppMinted for standard compatibility)
    event Registered(uint256 indexed tokenId, string dataUrl, address indexed registerer, bytes32 indexed didHash, uint8 versionMajor, uint16 interfaces, uint256 registrationBlock, uint256 registrationTimestamp);

    constructor() ERC721("OMA3 App Registry", "OMA3APP") Ownable(msg.sender) {}

    /**
     * @dev Set the metadata contract address (onlyOwner)
     * @param _metadataContract Address of the metadata contract
     */
    function setMetadataContract(address _metadataContract) external onlyOwner {
        require(_metadataContract != address(0), "Invalid metadata contract address");
        metadataContract = IOMA3AppMetadata(_metadataContract);
    }

    function setOwnershipResolver(address _resolver) external onlyOwner {
        require(_resolver != address(0), "Invalid ownership resolver address");
        ownershipResolver = IOMA3OwnershipResolver(_resolver);
    }

    function setDataUrlResolver(address _resolver) external onlyOwner {
        require(_resolver != address(0), "Invalid data URL resolver address");
        dataUrlResolver = IOMA3DataUrlResolver(_resolver);
    }

    function setRegistrationResolver(address _resolver) external onlyOwner {
        require(
            _resolver != address(0),
            "Invalid registration resolver address"
        );
        registrationResolver = IOMA3RegistrationResolver(_resolver);
    }

    /**
     * @dev Enable or disable dataUrl attestation requirement
     * @param _require True to require attestations, false to disable
     * 
     * Note: When disabled (default), apps can be minted without dataHash attestations.
     * When enabled, the dataUrlResolver must validate all dataHash values.
     */
    function setRequireDataUrlAttestation(bool _require) external onlyOwner {
        requireDataUrlAttestation = _require;
    }

    /**
     * @dev Helper function to convert DID string to hash
     * @param didString The DID as string
     * @return didHash The keccak256 hash of the DID
     */
    function getDidHash(string memory didString) public pure returns (bytes32) {
        return keccak256(bytes(didString));
    }

    /**
     * @dev Helper function to resolve DID + major version to token ID
     * @param didString The DID as string
     * @param major The major version
     * @return tokenId The token ID for this DID + major version
     */
    function _resolveToken(string memory didString, uint8 major) internal view returns (uint256) {
        bytes32 didHash = getDidHash(didString);
        return _resolveTokenByHash(didHash, major);
    }

    /**
     * @dev Helper function to resolve DID hash + major version to token ID
     * @param didHash The DID hash
     * @param major The major version
     * @return tokenId The token ID for this DID + major version
     */
    function _resolveTokenByHash(bytes32 didHash, uint8 major) internal view returns (uint256) {
        return _didMajorToToken[didHash][major];
    }

    /**
     * @dev Validate trait constraints (shared by mint and update functions)
     * @param traitHashes Array of trait hashes to validate
     */
    function _validateTraits(bytes32[] memory traitHashes) internal pure {
        if (traitHashes.length > MAX_TRAITS) {
            revert TooManyTraits(traitHashes.length);
        }
    }

    /**
     * @dev Validate that metadataJson hash matches the provided dataHash
     * @param metadataJson The JSON metadata string
     * @param dataHash The expected hash
     * @param dataHashAlgorithm The hash algorithm used (0=keccak256, 1=sha256)
     */
    function _validateMetadataHash(
        string memory metadataJson,
        bytes32 dataHash,
        uint8 dataHashAlgorithm
    ) internal pure {
        if (bytes(metadataJson).length > 0) {
            bytes32 computedHash;
            if (dataHashAlgorithm == 0) {
                // keccak256
                computedHash = keccak256(bytes(metadataJson));
            } else if (dataHashAlgorithm == 1) {
                // sha256
                computedHash = sha256(bytes(metadataJson));
            } else {
                // For future algorithms, require empty metadataJson or matching implementation
                revert InvalidDataHashAlgorithm(dataHashAlgorithm);
            }
            
            if (computedHash != dataHash) {
                revert DataHashMismatch(computedHash, dataHash);
            }
        }
    }

    /**
     * @dev Get the latest (highest) major version for a DID hash
     * @param didHash The DID hash (keccak256 of DID string)
     * @return major The highest major version number for this DID
     */
    function latestMajor(bytes32 didHash) external view returns (uint8) {
        if (!_didExists[didHash]) revert DIDHashNotFound(didHash);
        return _didToLatestMajor[didHash];
    }

    /// @notice Ensures only the current NFT owner can perform the action
    modifier onlyAppOwner(string memory didString, uint8 major) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        if (ownerOf(tokenId) != msg.sender) revert NotAppOwner(didString, major);
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // ERC721 COMPATIBILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════

    /**
     * @dev Get DID by token ID (standard token → metadata resolution pattern)
     * @param tokenId The token ID to query
     * @return The DID string for the given token
     */
    function getDIDByTokenId(
        uint256 tokenId
    ) external view returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert InvalidAgent(tokenId);
        return _apps[tokenId].did;
    }

    /**
     * @notice Returns the metadata URI for the given `tokenId`.
     * @dev Returns the off-chain `dataUrl` stored for the app, which may be an HTTPS/IPFS URL
     *      or a data:application/json;base64 URI per the OMA3 spec.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert InvalidAgent(tokenId);
        return _apps[tokenId].dataUrl;
    }


    /**
     * @dev Override supportsInterface for multiple inheritance
     * @param interfaceId The interface identifier
     * @return bool True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable)
        returns (bool)
    {
        // ERC-8004 interface ID: calculated from register(string) and getMetadata(uint256,string) function selectors
        // bytes4(keccak256("register(string)")) ^ bytes4(keccak256("getMetadata(uint256,string)"))
        return 
            interfaceId == 0x6d9ad0dc || // ERC-8004 interface ID
            super.supportsInterface(interfaceId);
    }



    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // INHERITED FUNCTIONS FROM OPENZEPPELIN
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // 
    // From ERC721:
    // - function ownerOf(uint256 tokenId) external view returns (address)
    // - function balanceOf(address owner) external view returns (uint256)
    // - function approve(address to, uint256 tokenId) external
    // - function getApproved(uint256 tokenId) external view returns (address)
    // - function setApprovalForAll(address operator, bool approved) external
    // - function isApprovedForAll(address owner, address operator) external view returns (bool)
    // - function transferFrom(address from, address to, uint256 tokenId) external
    // - function safeTransferFrom(address from, address to, uint256 tokenId) external
    // - function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external
    // - function supportsInterface(bytes4 interfaceId) external view returns (bool)
    // - function tokenURI(uint256 tokenId) external view returns (string memory)
    //
    // From Ownable:
    // - function owner() external view returns (address)
    // - function transferOwnership(address newOwner) external
    // - function renounceOwnership() external
    //
    // From ReentrancyGuard:
    // - modifier nonReentrant (already used in mint function)
    //
    // NOTE: Version changes are only possible through updateAppControlled() with actual content changes.
    // This ensures transparency - versions cannot be bumped without corresponding metadata updates.
    // The dataUrl JSON specification includes version field that must sync with on-chain version.
    //
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════

    /**
     * @dev Mint a new application token with optional metadata storage
     * @param didString The DID as string
     * @param interfaces Bitmap of supported interfaces
     * @param dataUrl URL to off-chain metadata
     * @param dataHash Hash of the off-chain data
     * @param dataHashAlgorithm Algorithm used for dataHash
     * @param fungibleTokenId Optional CAIP-19 token ID
     * @param contractId Optional CAIP-10 contract address
     * @param initialVersionMajor Initial version major number
     * @param initialVersionMinor Initial version minor number  
     * @param initialVersionPatch Initial version patch number
     * @param traitHashes Array of trait hashes for tagging
     * @param metadataJson Optional JSON metadata to store on-chain (empty string to skip)
     * @return tokenId The newly minted token ID
     */
    function mint(
        string memory didString,
        uint16 interfaces,
        string memory dataUrl,
        bytes32 dataHash,
        uint8 dataHashAlgorithm,
        string memory fungibleTokenId,
        string memory contractId,
        uint8 initialVersionMajor,
        uint8 initialVersionMinor,
        uint8 initialVersionPatch,
        bytes32[] memory traitHashes,
        string memory metadataJson
    ) public nonReentrant returns (uint256) {
        return
            _mintInternal(
                didString,
                interfaces,
                dataUrl,
                dataHash,
                dataHashAlgorithm,
                fungibleTokenId,
                contractId,
                initialVersionMajor,
                initialVersionMinor,
                initialVersionPatch,
                traitHashes,
                metadataJson
            );
    }

    /**
     * @dev Internal mint function - uses msg.sender as minter
     * @param didString The DID as string
     * @param interfaces Bitmap of supported interfaces
     * @param dataUrl URL to off-chain metadata
     * @param dataHash Hash of the off-chain data
     * @param dataHashAlgorithm Algorithm used for dataHash
     * @param fungibleTokenId Optional CAIP-19 token ID
     * @param contractId Optional CAIP-10 contract address
     * @param initialVersionMajor Initial version major number
     * @param initialVersionMinor Initial version minor number
     * @param initialVersionPatch Initial version patch number
     * @param traitHashes Array of trait hashes for tagging
     * @param metadataJson Optional JSON metadata to store on-chain (empty string to skip)
     * @return tokenId The newly minted token ID
     */
    function _mintInternal(
        string memory didString,
        uint16 interfaces,
        string memory dataUrl,
        bytes32 dataHash,
        uint8 dataHashAlgorithm,
        string memory fungibleTokenId,
        string memory contractId,
        uint8 initialVersionMajor,
        uint8 initialVersionMinor,
        uint8 initialVersionPatch,
        bytes32[] memory traitHashes,
        string memory metadataJson
    ) internal returns (uint256) {
        // Validations
        if (bytes(didString).length == 0) revert DIDCannotBeEmpty();
        if (bytes(didString).length > MAX_DID_LENGTH) revert DIDTooLong(bytes(didString).length);
        if (interfaces == 0) revert InterfacesCannotBeEmpty();
        if (bytes(dataUrl).length == 0) revert DataUrlCannotBeEmpty();
        if (bytes(dataUrl).length > MAX_URL_LENGTH) revert DataUrlTooLong(bytes(dataUrl).length);
        if (bytes(fungibleTokenId).length > MAX_URL_LENGTH) revert FungibleTokenIdTooLong(bytes(fungibleTokenId).length);
        if (bytes(contractId).length > MAX_URL_LENGTH) revert ContractIdTooLong(bytes(contractId).length);
        _validateTraits(traitHashes);

        // Note: dataHashAlgorithm validation removed to allow future algorithm extensions

        // DID + Major version uniqueness and fungible token consistency validation
        bytes32 didHash = getDidHash(didString);

        // Resolver validations (if resolvers are set)
        if (address(ownershipResolver) != address(0)) {
            // Check ownership: caller must be the current DID owner
            address didOwner = ownershipResolver.currentOwner(didHash);
            require(didOwner == msg.sender, "NOT_DID_OWNER");
        }

        // Only check dataUrl attestation if feature is enabled
        if (requireDataUrlAttestation && address(dataUrlResolver) != address(0)) {
            // Check data hash: must be attested by trusted oracle
            require(dataUrlResolver.checkDataHashAttestation(didHash, dataHash), "DATA_HASH_NOT_ATTESTED");
        }
        
        // Check if this specific (DID, major) combination already exists
        if (_didMajorToToken[didHash][initialVersionMajor] != 0) {
            revert DIDMajorAlreadyExists(didString, initialVersionMajor);
        }   
        
        // Check fungible token consistency for existing DIDs
        string memory existingFungibleTokenId = _didToFungibleTokenId[didHash];
        if (bytes(existingFungibleTokenId).length > 0) {
            // DID exists - validate fungible token consistency
            if (keccak256(bytes(existingFungibleTokenId)) != keccak256(bytes(fungibleTokenId))) {
                revert NewDIDRequired("Fungible token change requires new DID");
            }
            // Update latest major if this is higher
            if (initialVersionMajor > _didToLatestMajor[didHash]) {
                _didToLatestMajor[didHash] = initialVersionMajor;
            }
        } else {
            // First time minting this DID - store the fungible token ID and latest major
            _didToFungibleTokenId[didHash] = fungibleTokenId;
            _didToLatestMajor[didHash] = initialVersionMajor;
            _didExists[didHash] = true;
        }

        // Mint token
        _totalTokens++;
        uint256 tokenId = _totalTokens;
        _mint(msg.sender, tokenId);

        // Create version history with initial version
        Version[] memory versions = new Version[](1);
        versions[0] = Version(initialVersionMajor, initialVersionMinor, initialVersionPatch);

        // Store app data
        _apps[tokenId] = App({
            minter: msg.sender,
            interfaces: interfaces,
            versionMajor: initialVersionMajor,
            status: 0, // Active
            dataHashAlgorithm: dataHashAlgorithm,
            dataHash: dataHash,
            did: didString,
            fungibleTokenId: fungibleTokenId,
            contractId: contractId,
            dataUrl: dataUrl,
            versionHistory: versions,
            traitHashes: traitHashes
        });

        // Store mappings
        _didMajorToToken[didHash][initialVersionMajor] = tokenId;
        // Note: Owner tracking handled automatically by ERC721Enumerable
        
        // Track active apps for efficient queries
        _activeTokenIdToIndex[tokenId] = _activeTokenIds.length;
        _activeTokenIds.push(tokenId); // New apps start as active (status = 0)

        // Store registration tracking for bounded event log queries (only on first DID registration)
        if (registrationBlock[didHash] == 0) {
            registrationBlock[didHash] = block.number;
            registrationTimestamp[didHash] = block.timestamp;
        }

        // Emit trait event (bulk)
        if (traitHashes.length > 0) {
            emit TraitsUpdated(didHash, initialVersionMajor, tokenId, traitHashes);
        }

        // Store metadata on-chain if provided
        if (bytes(metadataJson).length > 0) {
            _setMetadataJson(didString, initialVersionMajor, initialVersionMinor, initialVersionPatch, metadataJson, dataHash, dataHashAlgorithm);
        }

        // Emit ERC-8004 compliant Registered event (extended with OMATrust fields)
        emit Registered(
            tokenId,
            dataUrl,
            msg.sender,
            didHash,
            initialVersionMajor,
            interfaces,
            block.number,
            block.timestamp
        );

        if (
            initialVersionMajor > 0 ||
            initialVersionMinor > 0 ||
            initialVersionPatch > 0
        ) {
            emit VersionAdded(
                didHash,
                initialVersionMajor,
                tokenId,
                initialVersionMinor,
                initialVersionPatch
            );
        }

        return tokenId;
    }

    /**
     * NOTE: The public setMetadataJson() function has been removed.
     * 
     * Metadata updates are now handled atomically via updateAppControlled() with the 
     * metadataJson parameter. This ensures:
     * - Single version history entry per update
     * - Proper semantic versioning validation
     * - Consistent dataHash updates on the App struct
     * - Atomic transaction (all or nothing)
     */

    /**
     * @dev Internal function to set metadata with validation
     * @param didString The DID as string
     * @param major Major version number
     * @param minor Minor version number
     * @param patch Patch version number
     * @param metadataJson JSON string containing the app metadata
     * @param dataHash Hash of the metadata JSON
     * @param dataHashAlgorithm Algorithm used for dataHash (0=keccak256, 1=sha256)
     */
    function _setMetadataJson(
        string memory didString,
        uint8 major,
        uint8 minor,
        uint8 patch,
        string memory metadataJson,
        bytes32 dataHash,
        uint8 dataHashAlgorithm
    ) internal {
        // Validate metadataJson hash matches dataHash
        _validateMetadataHash(metadataJson, dataHash, dataHashAlgorithm);
        
        // Call metadata contract if set, passing full version context
        if (address(metadataContract) != address(0)) {
            metadataContract.setMetadataForRegistry(didString, major, minor, patch, metadataJson);
        }
    }

    /**
     * @dev Update the status of an application
     * @param didString The DID as string
     * @param newStatus The new status (0=active, 1=deprecated, 2=replaced)
     */
    function updateStatus(
        string memory didString,
        uint8 major,
        uint8 newStatus
    ) external onlyAppOwner(didString, major) nonReentrant {
        bytes32 didHash = getDidHash(didString);
        uint256 tokenId = _resolveTokenByHash(didHash, major);
        uint8 oldStatus = _apps[tokenId].status;
        
        // No-op if status unchanged (gas optimization)
        if (oldStatus == newStatus) {
            return;
        }
        
        _apps[tokenId].status = newStatus;
        
        // Update active apps indexing
        if (oldStatus == 0 && newStatus != 0) {
            // Was active, now inactive - remove from active list (O(1) removal)
            uint256 indexToRemove = _activeTokenIdToIndex[tokenId];
            uint256 lastTokenId = _activeTokenIds[_activeTokenIds.length - 1];
            
            // Move last element to the gap
            _activeTokenIds[indexToRemove] = lastTokenId;
            _activeTokenIdToIndex[lastTokenId] = indexToRemove;
            
            // Remove the last element and clean up mapping
            _activeTokenIds.pop();
            delete _activeTokenIdToIndex[tokenId];
        } else if (oldStatus != 0 && newStatus == 0) {
            // Was inactive, now active - add to active list
            _activeTokenIdToIndex[tokenId] = _activeTokenIds.length;
            _activeTokenIds.push(tokenId);
        }
        
        emit StatusUpdated(didHash, major, tokenId, newStatus, block.timestamp);
    }





    /**
     * @dev Update app data, interfaces, and/or traits with controlled versioning
     * @param didString The DID as string
     * @param major The major version of the app to update
     * @param newDataUrl New data URL (empty string "" = no change)
     * @param newDataHash New data hash (bytes32(0) = no change, REQUIRED if traits change)
     * @param newDataHashAlgorithm New hash algorithm (current value = no change)
     * @param newInterfaces New interfaces bitmap (0 = no change, >0 = new interfaces)
     * @param newTraitHashes New trait hashes (empty array [] = no change)
     * @param newMinor New minor version (must be > current if interfaces change)
     * @param newPatch New patch version (must be > current if data/trait changes, unless minor++)
     * @param metadataJson Optional metadata JSON string (empty string "" = no metadata update)
     * @notice Trait changes require new data hash for auditability
     * @notice Interface changes require minor increment, data/trait changes require patch increment
     * @notice Metadata is only stored if provided and different from current
     */
    function updateAppControlled(
        string memory didString,
        uint8 major,
        string memory newDataUrl,
        bytes32 newDataHash,
        uint8 newDataHashAlgorithm,
        uint16 newInterfaces,
        bytes32[] memory newTraitHashes,
        uint8 newMinor,
        uint8 newPatch,
        string memory metadataJson
    ) external onlyAppOwner(didString, major) nonReentrant {
        bytes32 didHash = getDidHash(didString);
        uint256 tokenId = _resolveTokenByHash(didHash, major);
        App storage app = _apps[tokenId];
        
        // Detect what changes are being made
        bool hasDataChanges = (
            bytes(newDataUrl).length > 0 && 
            keccak256(bytes(newDataUrl)) != keccak256(bytes(app.dataUrl))
        ) || (
            newDataHash != bytes32(0) && 
            newDataHash != app.dataHash
        ) || (
            newDataHashAlgorithm != app.dataHashAlgorithm
        );
        
        bool hasInterfaceChanges = (newInterfaces != 0 && newInterfaces != app.interfaces);
        
        bool hasTraitChanges = (newTraitHashes.length > 0);
        
        // Must have at least one change
        if (!hasDataChanges && !hasInterfaceChanges && !hasTraitChanges) {
            revert NoChangesSpecified();
        }
        
        // Get current version for validation
        Version storage currentVersion = app.versionHistory[app.versionHistory.length - 1];
        
        // SemVer validation rules
        if (hasInterfaceChanges) {
            // Rule 1: Interface changes require minor++
            if (newMinor <= currentVersion.minor) {
                revert MinorIncrementRequired(currentVersion.minor, newMinor);
            }
            
            // Rule 2: Interface changes must be additive only
            if ((newInterfaces & app.interfaces) != app.interfaces) {
                revert InterfaceRemovalNotAllowed(app.interfaces, newInterfaces);
            }
        }
        
        if (hasDataChanges || hasTraitChanges) {
            // Rule 3: Data OR trait changes require patch++ UNLESS minor++
            if (newMinor <= currentVersion.minor && newPatch <= currentVersion.patch) {
                revert PatchIncrementRequired(currentVersion.patch, newPatch);
            }
        }
        
        // Validate data constraints if updating
        if (hasDataChanges) {
            if (bytes(newDataUrl).length == 0) revert DataUrlCannotBeEmpty();
            if (bytes(newDataUrl).length > MAX_URL_LENGTH) revert DataUrlTooLong(bytes(newDataUrl).length);
            // Note: dataHashAlgorithm validation removed to allow future algorithm extensions
        }
        
        // Validate trait constraints if updating
        if (hasTraitChanges) {
            _validateTraits(newTraitHashes);
            // Require new data hash for trait changes (auditability)
            if (newDataHash == bytes32(0)) {
                revert DataHashRequiredForTraitChange();
            }
        }
        
        // Apply changes
        if (hasDataChanges) {
            app.dataUrl = newDataUrl;
            app.dataHash = newDataHash;
            app.dataHashAlgorithm = newDataHashAlgorithm;
            emit DataUrlUpdated(didHash, major, tokenId, newDataUrl, newDataHash, newDataHashAlgorithm);
        }
        
        if (hasInterfaceChanges) {
            app.interfaces = newInterfaces;
            emit InterfacesUpdated(didHash, major, tokenId, newInterfaces);
        }
        
        if (hasTraitChanges) {
            app.traitHashes = newTraitHashes;
            emit TraitsUpdated(didHash, major, tokenId, newTraitHashes);
        }
        
        // Add new version to history
        app.versionHistory.push(Version({
            major: major,
            minor: newMinor,
            patch: newPatch
        }));
        
        emit VersionAdded(didHash, major, tokenId, newMinor, newPatch);
        
        // Store metadata if provided (only pass if metadata actually changed)
        if (bytes(metadataJson).length > 0) {
            _setMetadataJson(didString, major, newMinor, newPatch, metadataJson, newDataHash, newDataHashAlgorithm);
        }
    }

    /**
     * @dev Get an application by DID
     * @param didString The DID as string
     * @return app The application data
     */
    function getApp(string memory didString, uint8 major) external view returns (App memory) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        return _apps[tokenId];
    }

    /**
     * @notice Get metadata value for a specific key (ERC-8004 compliance)
     * @dev Returns raw bytes values matching ERC-8004 reference implementation
     *      Strings are returned as bytes(string), primitives as abi.encodePacked()
     * @param tokenId The token ID to query
     * @param key The metadata key to retrieve
     * @return value The metadata value as raw bytes
     */
    function getMetadata(uint256 tokenId, string memory key) external view returns (bytes memory value) {
        if (_ownerOf(tokenId) == address(0)) revert InvalidAgent(tokenId);
        
        App storage app = _apps[tokenId];
        bytes32 keyHash = keccak256(bytes(key));
        
        // Map keys to App struct fields
        // Strings: return bytes(string) for direct string conversion
        // Primitives: return abi.encodePacked() for compact encoding
        if (keyHash == keccak256(bytes("dataUrl")) || keyHash == keccak256(bytes("agentURI"))) {
            return bytes(app.dataUrl);
        } else if (keyHash == keccak256(bytes("did"))) {
            return bytes(app.did);
        } else if (keyHash == keccak256(bytes("fungibleTokenId"))) {
            return bytes(app.fungibleTokenId);
        } else if (keyHash == keccak256(bytes("contractId"))) {
            return bytes(app.contractId);
        } else if (keyHash == keccak256(bytes("dataHash"))) {
            return abi.encodePacked(app.dataHash);
        } else if (keyHash == keccak256(bytes("dataHashAlgorithm"))) {
            return abi.encodePacked(app.dataHashAlgorithm);
        } else if (keyHash == keccak256(bytes("interfaces"))) {
            return abi.encodePacked(app.interfaces);
        } else if (keyHash == keccak256(bytes("status"))) {
            return abi.encodePacked(app.status);
        } else if (keyHash == keccak256(bytes("versionMajor"))) {
            return abi.encodePacked(app.versionMajor);
        } else if (keyHash == keccak256(bytes("minter"))) {
            return abi.encodePacked(app.minter);
        } else if (keyHash == keccak256(bytes("traitHashes"))) {
            // For arrays, we need to encode them properly
            // abi.encodePacked concatenates array elements without length prefix
            return abi.encode(app.traitHashes);
        } else if (keyHash == keccak256(bytes("versionHistory"))) {
            // Version history is a struct array, needs full encoding
            return abi.encode(app.versionHistory);
        } else {
            revert MetadataUnavailable(tokenId, key);
        }
    }

    /**
     * @dev Check if an app has any of the specified traits
     * @param didString The DID as string
     * @param traits Array of trait hashes to check
     * @return bool True if the app has at least one of the traits
     */
    function hasAnyTraits(string memory didString, uint8 major, bytes32[] memory traits) external view returns (bool) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        
        bytes32[] memory appTraits = _apps[tokenId].traitHashes;
        
        for (uint256 i = 0; i < traits.length; i++) {
            for (uint256 j = 0; j < appTraits.length; j++) {
                if (traits[i] == appTraits[j]) return true;
            }
        }
        return false;
    }

    /**
     * @dev Check if an app has all of the specified traits
     * @param didString The DID as string
     * @param traits Array of trait hashes to check
     * @return bool True if the app has all of the traits
     */
    function hasAllTraits(string memory didString, uint8 major, bytes32[] memory traits) external view returns (bool) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        
        bytes32[] memory appTraits = _apps[tokenId].traitHashes;
        
        for (uint256 i = 0; i < traits.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < appTraits.length; j++) {
                if (traits[i] == appTraits[j]) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    /**
     * @dev Get total number of apps by status for the caller's owned apps
     * @param status The status to query (0=active accessible to all, others restricted to owner)
     * @return uint256 Total number of apps with the given status
     */
    function getTotalAppsByStatus(uint8 status) external view returns (uint256) {
        if (status == 0) {
            // Active apps: use efficient array (accessible to all)
            return _activeTokenIds.length;
        } else {
            // Non-active apps: only show caller's own apps for privacy
            // Apps are deactivated for a reason - shouldn't be publicly browsable
            uint256 totalOwned = balanceOf(msg.sender);
            uint256 count = 0;
            
            for (uint256 i = 0; i < totalOwned; i++) {
                uint256 tokenId = tokenOfOwnerByIndex(msg.sender, i);
                if (_apps[tokenId].status == status) {
                    count++;
                }
            }
            return count;
        }
    }

    /**
     * @dev Returns applications with a specific status, using client-side pagination
     * @param status The status to filter by (0=active accessible to all, others restricted to caller's apps)
     * @param startIndex The starting index for pagination (0-based)
     * @return apps Array of App structs
     */
    function getAppsByStatus(uint8 status, uint256 startIndex) external view returns (App[] memory apps, uint256 nextStartIndex) {
        if (status == 0) {
            // Active apps: use efficient array (accessible to all)
            if (startIndex >= _activeTokenIds.length) {
                return (new App[](0), 0);
            }
            
            uint256 endIndex = startIndex + MAX_APPS_PER_PAGE;
            if (endIndex > _activeTokenIds.length) {
                endIndex = _activeTokenIds.length;
            }
            
            apps = new App[](endIndex - startIndex);
            for (uint256 i = startIndex; i < endIndex; i++) {
                uint256 tokenId = _activeTokenIds[i];
                apps[i - startIndex] = _apps[tokenId];
            }
            
            // Calculate next start index (0 if no more pages)
            nextStartIndex = (endIndex < _activeTokenIds.length) ? endIndex : 0;
        } else {
            // Non-active apps: only show caller's own apps for privacy
            // Apps are deactivated for a reason - shouldn't be publicly browsable
            uint256 totalOwned = balanceOf(msg.sender);
            
            if (startIndex >= totalOwned) {
                return (new App[](0), 0);
            }
            
            // Simple: allocate max size, collect what we can, return right size
            App[] memory tempApps = new App[](MAX_APPS_PER_PAGE);
            uint256 collected = 0;
            uint256 i;
            
            for (i = startIndex; i < totalOwned && collected < MAX_APPS_PER_PAGE; i++) {
                uint256 tokenId = tokenOfOwnerByIndex(msg.sender, i);
                if (_apps[tokenId].status == status) {
                    tempApps[collected] = _apps[tokenId];
                    collected++;
                }
            }
            
            // Return exactly what we collected
            apps = new App[](collected);
            for (uint256 j = 0; j < collected; j++) {
                apps[j] = tempApps[j];
            }
            
            // Calculate next start index: if we might have more apps to scan
            nextStartIndex = (i < totalOwned) ? i : 0;
        }
        
        return (apps, nextStartIndex);
    }

    /**
     * @dev Returns active applications using client-side pagination
     * @param startIndex The starting index for pagination (0-based)  
     * @return apps Array of App structs
     * @return nextStartIndex Next index for pagination (0 if no more pages)
     */
    function getApps(uint256 startIndex) external view returns (App[] memory apps, uint256 nextStartIndex) {
        (App[] memory result, uint256 next) = this.getAppsByStatus(0, startIndex); // 0 = Active status
        return (result, next);
    }

    /**
     * @dev Returns active applications filtered by interface type with pagination
     * @param interfaceMask The interface mask to filter by (1=Human, 2=API, 4=Smart Contract)
     *        Uses OR logic: if (app.interfaces & interfaceMask) != 0, app is included
     * @param startIndex The starting index for pagination (0-based)
     * @return apps Array of matching apps for this page
     * @return nextStartIndex Starting index for next page (0 if last page)
     * 
     * Examples:
     * - interfaceMask = 1: Returns apps with Human interface
     * - interfaceMask = 2: Returns apps with API interface  
     * - interfaceMask = 3: Returns apps with Human OR API interfaces
     * - interfaceMask = 7: Returns apps with any interface
     */
    function getAppsByInterface(uint16 interfaceMask, uint256 startIndex)
        external
        view
        returns (App[] memory apps, uint256 nextStartIndex)
    {
        // Only search active apps for public browsing
        uint256 totalActive = _activeTokenIds.length;
        
        if (startIndex >= totalActive) {
            return (new App[](0), 0);
        }
        
        // Collect matching apps up to MAX_APPS_PER_PAGE
        App[] memory tempApps = new App[](MAX_APPS_PER_PAGE);
        uint256 collected = 0;
        uint256 i;
        
        for (i = startIndex; i < totalActive && collected < MAX_APPS_PER_PAGE; i++) {
            uint256 tokenId = _activeTokenIds[i];
            App storage app = _apps[tokenId];
            
            // Check if app has any of the requested interfaces (OR logic)
            if ((app.interfaces & interfaceMask) != 0) {
                tempApps[collected] = app;
                collected++;
            }
        }
        
        // Return exactly what we collected
        apps = new App[](collected);
        for (uint256 j = 0; j < collected; j++) {
            apps[j] = tempApps[j];
        }
        
        // Calculate next start index: continue if we didn't scan all active apps
        nextStartIndex = (i < totalActive) ? i : 0;
        
        return (apps, nextStartIndex);
    }

    /**
     * @dev Get total number of apps by owner (current NFT owner, not original minter)
     * Uses ERC721Enumerable's balanceOf for accurate ownership tracking
     * @param owner The owner's address
     * @return uint256 Total number of apps owned by the address
     */
    function getTotalAppsByOwner(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    /**
     * @dev Returns applications by owner (returns all remaining apps from startIndex)
     * Uses ERC721Enumerable's tokenOfOwnerByIndex for accurate ownership tracking after transfers
     * Note: "owner" here means current NFT owner, which may differ from original minter
     * @param owner The owner's address
     * @param startIndex The starting index (0-based)
     * @return apps Array of App structs
     * @return nextStartIndex Always 0 (no pagination limit)
     */
    function getAppsByOwner(address owner, uint256 startIndex) external view returns (App[] memory apps, uint256 nextStartIndex) {
        uint256 totalOwned = balanceOf(owner);
        
        if (startIndex >= totalOwned) {
            return (new App[](0), 0);
        }
        
        // Return all remaining apps from startIndex onwards
        apps = new App[](totalOwned - startIndex);
        for (uint256 i = startIndex; i < totalOwned; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            apps[i - startIndex] = _apps[tokenId];
        }
        
        return (apps, 0); // Always 0 since we return all remaining apps
    }

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // ERC-8004 IDENTITY REGISTRY INTERFACE
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register a new agent with tokenURI only (uses resolver pre-commit)
     * @dev Implements ERC-8004 register(string) function
     * @param _tokenURI The URI pointing to the agent's metadata
     * @return The newly created agent ID (token ID)
     */
    function register(
        string memory _tokenURI
    ) external nonReentrant returns (uint256) {
        require(
            address(registrationResolver) != address(0),
            "Registration resolver not set"
        );

        // Load stored params from resolver (validates tokenURI matches)
        IOMA3RegistrationResolver.RegistrationStoredParams
            memory storedParams = registrationResolver.loadAndConsumeRegister(
                msg.sender,
                _tokenURI
            );

        // Call internal mint with stored params
        return
            _mintInternal(
                storedParams.didString,
                storedParams.interfaces,
                _tokenURI,
                storedParams.dataHash,
                storedParams.dataHashAlgorithm,
                storedParams.fungibleTokenId,
                storedParams.contractId,
                storedParams.initialVersionMajor,
                storedParams.initialVersionMinor,
                storedParams.initialVersionPatch,
                storedParams.traitHashes,
                storedParams.metadataJson
            );
    }

    /**
     * @notice Register a new agent with tokenURI and metadata
     * @dev Implements ERC-8004 register(string, MetadataEntry[]) function
     * @param _tokenURI The URI pointing to the agent's metadata
     * @param _metadata Array of metadata entries containing registration parameters
     * @return The newly created agent ID (token ID)
     */
    function register(
        string memory _tokenURI,
        MetadataEntry[] memory _metadata
    ) external nonReentrant returns (uint256) {
        // Parse metadata entries into mint parameters
        string memory didString;
        uint16 interfaces = 1; // Default to human interface
        bytes32 dataHash;
        uint8 dataHashAlgorithm = 0; // Default to keccak256
        string memory fungibleTokenId;
        string memory contractId;
        uint8 versionMajor = 1; // Default version
        uint8 versionMinor = 0;
        uint8 versionPatch = 0;
        bytes32[] memory traitHashes;
        string memory metadataJson;

        // Parse metadata entries
        for (uint256 i = 0; i < _metadata.length; i++) {
            bytes32 keyHash = keccak256(bytes(_metadata[i].key));

            if (keyHash == OMA3MetadataKeys.DID) {
                didString = abi.decode(_metadata[i].value, (string));
            } else if (keyHash == OMA3MetadataKeys.DATA_HASH) {
                dataHash = abi.decode(_metadata[i].value, (bytes32));
            } else if (keyHash == OMA3MetadataKeys.DATA_HASH_ALGORITHM) {
                dataHashAlgorithm = abi.decode(_metadata[i].value, (uint8));
            } else if (keyHash == OMA3MetadataKeys.INTERFACES) {
                interfaces = abi.decode(_metadata[i].value, (uint16));
            } else if (keyHash == OMA3MetadataKeys.FUNGIBLE_TOKEN_ID) {
                fungibleTokenId = abi.decode(_metadata[i].value, (string));
            } else if (keyHash == OMA3MetadataKeys.CONTRACT_ID) {
                contractId = abi.decode(_metadata[i].value, (string));
            } else if (keyHash == OMA3MetadataKeys.VERSION_MAJOR) {
                versionMajor = abi.decode(_metadata[i].value, (uint8));
            } else if (keyHash == OMA3MetadataKeys.VERSION_MINOR) {
                versionMinor = abi.decode(_metadata[i].value, (uint8));
            } else if (keyHash == OMA3MetadataKeys.VERSION_PATCH) {
                versionPatch = abi.decode(_metadata[i].value, (uint8));
            } else if (keyHash == OMA3MetadataKeys.TRAIT_HASHES) {
                traitHashes = abi.decode(_metadata[i].value, (bytes32[]));
            } else if (keyHash == OMA3MetadataKeys.METADATA_JSON) {
                metadataJson = abi.decode(_metadata[i].value, (string));
            }
        }

        // Call internal mint (it will validate required fields)
        return
            _mintInternal(
                didString,
                interfaces,
                _tokenURI,
                dataHash,
                dataHashAlgorithm,
                fungibleTokenId,
                contractId,
                versionMajor,
                versionMinor,
                versionPatch,
                traitHashes,
                metadataJson
            );
    }
}
