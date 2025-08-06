// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title OMA3AppRegistry
 * @dev Registry for OMA3 applications using ERC721 tokens
 */
contract OMA3AppRegistry is ERC721, Ownable, ReentrancyGuard {

    // Version struct for efficient storage and comparison
    struct Version {
        uint8 major;
        uint8 minor;
        uint8 patch;
    }

    // App struct optimized for gas efficiency
    // Immutable fields: minter, versionMajor, did, fungibleTokenId, contractId
    // Mutable fields: interfaces, status, dataHashAlgorithm, dataHash, dataUrl, versionHistory, keywordHashes
    struct App {
        // Slot 1 (32 bytes)
        address minter;                // 20 bytes - Original creator/minter (immutable)
        uint16 interfaces;             // 2 bytes - Interface bitmap (1=human, 2=api, 4=mcp. Can combine: 5=human+mcp) (mutable)
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
        bytes32[] keywordHashes;       // Array of keyword hashes
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
    error TooManyKeywords(uint256 count);         // Keyword array exceeds MAX_KEYWORDS limit
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
    error DataHashRequiredForKeywordChange();   // New data hash required when updating keywords


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
    mapping(address => uint256[]) private _ownerToTokenIds; // Owner to token IDs

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    // STORAGE MAPPINGS FOR EFFICIENT QUERIES
    // ═══════════════════════════════════════════════════════════════════════════════════════════════════════
    
    // Active app indexing for efficient queries (optimizes the common case)
    uint256[] private _activeTokenIds; // Array of active app token IDs
    mapping(uint256 => uint256) private _activeTokenIdToIndex; // tokenId => index in _activeTokenIds array

    // Registration tracking for bounded event log queries
    mapping(bytes32 => uint256) public registrationBlock; // DID hash => block number when first registered
    mapping(bytes32 => uint256) public registrationTimestamp; // DID hash => timestamp when first registered


    // Constants
    uint256 private constant MAX_DID_LENGTH = 128;
    uint256 private constant MAX_URL_LENGTH = 256;
    uint256 private constant MAX_KEYWORDS = 20;
    uint256 private constant MAX_APPS_PER_PAGE = 100; // Maximum apps to return per query
    //uint256 private constant MAX_APPS_PER_PAGE = 4; // Maximum apps to return per query

    // Token ID counter
    // Note: OpenZeppelin ERC721 does not include totalSupply tracking
    // (ERC721Enumerable extension would add this but with higher gas costs)
    uint256 private _totalTokens; // Our custom counter for sequential token IDs and total supply

    // Events (indexed by didHash + major + tokenId for both DID-based and NFT ecosystem compatibility)
    // Note: For cross-chain DID resolution, use the canonical OMA3 deduplicator on OMAChain
    event AppMinted(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, address minter, uint16 interfaces, uint256 registrationBlock, uint256 registrationTimestamp);
    event StatusUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint8 newStatus, uint256 timestamp);
    event DataUrlUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, string newDataUrl, bytes32 newDataHash, uint8 dataHashAlgorithm);
    event VersionAdded(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint8 minor, uint8 patch);
    event KeywordsUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, bytes32[] newKeywordHashes);
    event InterfacesUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, uint16 newInterfaces);

    constructor() ERC721("OMA3 App Registry", "OMA3APP") Ownable(msg.sender) {}

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
     * @dev Validate keyword constraints (shared by mint and update functions)
     * @param keywordHashes Array of keyword hashes to validate
     */
    function _validateKeywords(bytes32[] memory keywordHashes) internal pure {
        if (keywordHashes.length > MAX_KEYWORDS) {
            revert TooManyKeywords(keywordHashes.length);
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
    function getDIDByTokenId(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _apps[tokenId].did;
    }

    /**
     * @dev Returns the total number of tokens (ERC721Enumerable compatibility)
     * @return Total supply of minted tokens
     */
    function totalSupply() public view returns (uint256) {
        return _totalTokens;
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
     * @dev Mint a new application token
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
     * @param keywordHashes Array of keyword hashes for tagging
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
        bytes32[] memory keywordHashes
    ) external nonReentrant returns (uint256) {
        // Validations
        if (bytes(didString).length == 0) revert DIDCannotBeEmpty();
        if (bytes(didString).length > MAX_DID_LENGTH) revert DIDTooLong(bytes(didString).length);
        if (interfaces == 0) revert InterfacesCannotBeEmpty();
        if (bytes(dataUrl).length == 0) revert DataUrlCannotBeEmpty();
        if (bytes(dataUrl).length > MAX_URL_LENGTH) revert DataUrlTooLong(bytes(dataUrl).length);
        if (bytes(fungibleTokenId).length > MAX_URL_LENGTH) revert FungibleTokenIdTooLong(bytes(fungibleTokenId).length);
        if (bytes(contractId).length > MAX_URL_LENGTH) revert ContractIdTooLong(bytes(contractId).length);
        _validateKeywords(keywordHashes);
        // Note: dataHashAlgorithm validation removed to allow future algorithm extensions

        // DID + Major version uniqueness and fungible token consistency validation
        bytes32 didHash = getDidHash(didString);
        
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
            keywordHashes: keywordHashes
        });

        // Store mappings
        _didMajorToToken[didHash][initialVersionMajor] = tokenId;
        _ownerToTokenIds[msg.sender].push(tokenId);
        
        // Track active apps for efficient queries
        _activeTokenIdToIndex[tokenId] = _activeTokenIds.length;
        _activeTokenIds.push(tokenId); // New apps start as active (status = 0)

        // Store registration tracking for bounded event log queries (only on first DID registration)
        if (registrationBlock[didHash] == 0) {
            registrationBlock[didHash] = block.number;
            registrationTimestamp[didHash] = block.timestamp;
        }

        // Emit keyword event (bulk)
        if (keywordHashes.length > 0) {
            emit KeywordsUpdated(didHash, initialVersionMajor, tokenId, keywordHashes);
        }

        emit AppMinted(didHash, initialVersionMajor, tokenId, msg.sender, interfaces, block.number, block.timestamp);
        if (initialVersionMajor > 0 || initialVersionMinor > 0 || initialVersionPatch > 0) {
            emit VersionAdded(didHash, initialVersionMajor, tokenId, initialVersionMinor, initialVersionPatch);
        }

        return tokenId;
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
     * @dev Update app data, interfaces, and/or keywords with controlled versioning
     * @param didString The DID as string
     * @param major The major version of the app to update
     * @param newDataUrl New data URL (empty string "" = no change)
     * @param newDataHash New data hash (bytes32(0) = no change, REQUIRED if keywords change)
     * @param newDataHashAlgorithm New hash algorithm (current value = no change)
     * @param newInterfaces New interfaces bitmap (0 = no change, >0 = new interfaces)
     * @param newKeywordHashes New keyword hashes (empty array [] = no change)
     * @param newMinor New minor version (must be > current if interfaces change)
     * @param newPatch New patch version (must be > current if data/keyword changes, unless minor++)
     * @notice Keyword changes require new data hash for auditability
     * @notice Interface changes require minor increment, data/keyword changes require patch increment
     */
    function updateAppControlled(
        string memory didString,
        uint8 major,
        string memory newDataUrl,
        bytes32 newDataHash,
        uint8 newDataHashAlgorithm,
        uint16 newInterfaces,
        bytes32[] memory newKeywordHashes,
        uint8 newMinor,
        uint8 newPatch
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
        
        bool hasKeywordChanges = (newKeywordHashes.length > 0);
        
        // Must have at least one change
        if (!hasDataChanges && !hasInterfaceChanges && !hasKeywordChanges) {
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
        
        if (hasDataChanges || hasKeywordChanges) {
            // Rule 3: Data OR keyword changes require patch++ UNLESS minor++
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
        
        // Validate keyword constraints if updating
        if (hasKeywordChanges) {
            _validateKeywords(newKeywordHashes);
            // Require new data hash for keyword changes (auditability)
            if (newDataHash == bytes32(0)) {
                revert DataHashRequiredForKeywordChange();
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
        
        if (hasKeywordChanges) {
            app.keywordHashes = newKeywordHashes;
            emit KeywordsUpdated(didHash, major, tokenId, newKeywordHashes);
        }
        
        // Add new version to history
        app.versionHistory.push(Version({
            major: major,
            minor: newMinor,
            patch: newPatch
        }));
        
        emit VersionAdded(didHash, major, tokenId, newMinor, newPatch);
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
     * @dev Check if an app has any of the specified keywords
     * @param didString The DID as string
     * @param keywords Array of keyword hashes to check
     * @return bool True if the app has at least one of the keywords
     */
    function hasAnyKeywords(string memory didString, uint8 major, bytes32[] memory keywords) external view returns (bool) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        
        bytes32[] memory appKeywords = _apps[tokenId].keywordHashes;
        
        for (uint256 i = 0; i < keywords.length; i++) {
            for (uint256 j = 0; j < appKeywords.length; j++) {
                if (keywords[i] == appKeywords[j]) return true;
            }
        }
        return false;
    }

    /**
     * @dev Check if an app has all of the specified keywords
     * @param didString The DID as string
     * @param keywords Array of keyword hashes to check
     * @return bool True if the app has all of the keywords
     */
    function hasAllKeywords(string memory didString, uint8 major, bytes32[] memory keywords) external view returns (bool) {
        uint256 tokenId = _resolveToken(didString, major);
        if (tokenId == 0) revert AppNotFound(didString, major);
        
        bytes32[] memory appKeywords = _apps[tokenId].keywordHashes;
        
        for (uint256 i = 0; i < keywords.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < appKeywords.length; j++) {
                if (keywords[i] == appKeywords[j]) {
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
            uint256[] storage ownerTokenIds = _ownerToTokenIds[msg.sender];
            uint256 count = 0;
            
            for (uint256 i = 0; i < ownerTokenIds.length; i++) {
                uint256 tokenId = ownerTokenIds[i];
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
            uint256[] storage ownerTokenIds = _ownerToTokenIds[msg.sender];
            
            if (startIndex >= ownerTokenIds.length) {
                return (new App[](0), 0);
            }
            
            // Simple: allocate max size, collect what we can, return right size
            App[] memory tempApps = new App[](MAX_APPS_PER_PAGE);
            uint256 collected = 0;
            uint256 i;
            
            for (i = startIndex; i < ownerTokenIds.length && collected < MAX_APPS_PER_PAGE; i++) {
                uint256 tokenId = ownerTokenIds[i];
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
            nextStartIndex = (i < ownerTokenIds.length) ? i : 0;
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
     * @dev Get total number of apps by minter
     * @param minter The minter's address
     * @return uint256 Total number of apps minted by the minter
     */
    function getTotalAppsByMinter(address minter) external view returns (uint256) {
        return _ownerToTokenIds[minter].length;
    }

    /**
     * @dev Returns applications by minter (returns all remaining apps from startIndex)
     * @param minter The minter's address
     * @param startIndex The starting index (0-based)
     * @return apps Array of App structs
     * @return nextStartIndex Always 0 (no pagination limit)
     */
    function getAppsByMinter(address minter, uint256 startIndex) external view returns (App[] memory apps, uint256 nextStartIndex) {
        uint256[] memory tokenIds = _ownerToTokenIds[minter];
        uint256 totalApps = tokenIds.length;
        
        if (startIndex >= totalApps) {
            return (new App[](0), 0);
        }
        
        // Return all remaining apps from startIndex onwards
        apps = new App[](totalApps - startIndex);
        for (uint256 i = startIndex; i < totalApps; i++) {
            apps[i - startIndex] = _apps[tokenIds[i]];
        }
        
        return (apps, 0); // Always 0 since we return all remaining apps
    }
} 