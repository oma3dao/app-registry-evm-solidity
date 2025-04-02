// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title OMA3AppRegistry
 * @dev Registry for OMA3 applications using ERC721 tokens
 */
contract OMA3AppRegistry is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using Strings for address;

    // Application status enum
    enum AppStatus {
        ACTIVE,
        DEPRECATED,
        REPLACED
    }

    // App struct to store all fields
    struct App {
        bytes32 name;        // 32 bytes - Application name
        bytes32 version;      // Version string in format x.y.z or x.y
        string did;          // 32 bytes - Decentralized Identifier
        string dataUrl;      // 32 bytes - General data URL
        string iwpsPortalUri; // 32 bytes - IWPS Portal URI
        string agentApiUri;   // 32 bytes - Agent API URI
        string contractAddress; // 32 bytes - Optional CAIP-2 compatible contract address
        address minter;      // 20 bytes - Address that minted the application
        AppStatus status;    // 1 byte - Current status (active/deprecated/replaced)
        bool hasContract;    // 1 byte - Flag to indicate if contractAddress is set
        // 7 bytes padding at the end for future upgrades
    }

    // Mapping from token ID to App
    mapping(uint256 => App) private _apps;
    
    // Mapping from DID to token ID
    mapping(string => uint256) private _didToTokenId;
    
    // Mapping from minter to array of token IDs
    mapping(address => uint256[]) private _minterToTokenIds;
    
    // Maximum number of apps to return per page
    // Limited to 100 for developer convenience while staying within reasonable limits
    // Each App struct contains:
    // - Fixed size fields: 89 bytes
    // - String fields: 1152 bytes (128 + 256 + 256 + 256 + 256)
    // Total per App: ~1241 bytes
    // Safe limit: ~100KB / 1241 bytes ≈ 100 Apps
    uint256 private constant MAX_APPS_PER_PAGE = 100;
    //uint256 private constant MAX_APPS_PER_PAGE = 2;

    // Maximum number of DIDs to return per page
    // Each DID in array takes: 32 bytes (length) + 128 bytes (content) = 160 bytes
    // Solidity return size limit: 2^24 - 1 bytes (16,777,215 bytes)
    // Safe limit: 16,777,215 / 160 ≈ 100,000 DIDs
    // Using 50,000 as a conservative limit for gas efficiency
    uint256 private constant MAX_DIDS_PER_PAGE = 50000;
    //uint256 private constant MAX_DIDS_PER_PAGE = 5;

    // Maximum length for URLs and DIDs
    uint256 private constant MAX_URL_LENGTH = 256;
    uint256 private constant MAX_DID_LENGTH = 128;
    
    // Error message prefix
    string private constant ERROR_PREFIX = "AppRegistry Contract Error: ";

    // Token ID configuration - using 1-based token IDs
    uint256 private _totalTokens; // Total number of tokens minted (also used as the next token ID)

    // Events
    event ApplicationMinted(uint256 indexed tokenId, string indexed did, address indexed minter);
    event ApplicationStatusUpdated(uint256 indexed tokenId, AppStatus status);

    constructor() ERC721("OMA3 App Registry", "OMA3APP") Ownable(msg.sender) {
        // TODO: Set base URI when we have the correct URL
        // _baseURI = "https://api.example.com/metadata/"; // Example URL
    }

     /**
     * @dev Public function to mint a new application token
     * @param did The DID of the application
     * @param name The name of the application
     * @param version The version string in format "x.y.z" or "x.y" (as bytes32)
     * @param dataUrl General data URL
     * @param iwpsPortalUri IWPS Portal URI
     * @param agentApiUri Agent API URI
     * @param contractAddress Optional CAIP-2 compatible contract address. Pass empty string ("") if no contract.
     * @return The token ID of the newly minted application
     */
    function mint(
        string memory did,
        bytes32 name,
        bytes32 version,
        string memory dataUrl,
        string memory iwpsPortalUri,
        string memory agentApiUri,
        string memory contractAddress
    ) public nonReentrant returns (uint256) {
        require(_didToTokenId[did] == 0, string(abi.encodePacked(ERROR_PREFIX, "DID already exists")));
        require(name != bytes32(0), string(abi.encodePacked(ERROR_PREFIX, "Name cannot be empty")));
        require(bytes(did).length <= MAX_DID_LENGTH, string(abi.encodePacked(ERROR_PREFIX, "DID too long")));
        require(bytes(dataUrl).length <= MAX_URL_LENGTH, string(abi.encodePacked(ERROR_PREFIX, "Data URL too long")));
        require(bytes(iwpsPortalUri).length <= MAX_URL_LENGTH, string(abi.encodePacked(ERROR_PREFIX, "IWPS Portal URI too long")));
        require(bytes(agentApiUri).length <= MAX_URL_LENGTH, string(abi.encodePacked(ERROR_PREFIX, "Agent API URI too long")));
        require(bytes(contractAddress).length <= MAX_URL_LENGTH, string(abi.encodePacked(ERROR_PREFIX, "Contract address too long")));
        require(version != bytes32(0), string(abi.encodePacked(ERROR_PREFIX, "Version cannot be empty")));
        
        _totalTokens++;
        uint256 newTokenId = _totalTokens;

        _mint(msg.sender, newTokenId);

        _apps[newTokenId] = App({
            name: name,
            version: version,
            did: did,
            dataUrl: dataUrl,
            iwpsPortalUri: iwpsPortalUri,
            agentApiUri: agentApiUri,
            contractAddress: contractAddress,
            minter: msg.sender,
            status: AppStatus.ACTIVE,
            hasContract: bytes(contractAddress).length > 0
        });

        _didToTokenId[did] = newTokenId;
        _minterToTokenIds[msg.sender].push(newTokenId);

        emit ApplicationMinted(newTokenId, did, msg.sender);
        return newTokenId;
    }

    /**
     * @dev Updates the status of an application
     * @param did The DID of the application
     * @param newStatus The new status to set
     */
    function updateStatus(string memory did, AppStatus newStatus) public {
        uint256 tokenId = _didToTokenId[did];
        require(tokenId != 0, string(abi.encodePacked(ERROR_PREFIX, "Application does not exist")));
        require(_apps[tokenId].minter == msg.sender, string(abi.encodePacked(ERROR_PREFIX, "Not the minter")));
        require(newStatus != AppStatus.ACTIVE || _apps[tokenId].status != AppStatus.REPLACED, 
            string(abi.encodePacked(ERROR_PREFIX, "Cannot reactivate replaced application")));
        
        _apps[tokenId].status = newStatus;
        emit ApplicationStatusUpdated(tokenId, newStatus);
    }

    /**
     * @dev Helper function to calculate the next token ID for pagination
     * @param currentTokenId The current token ID
     * @return The next token ID to use for the next call (0 if no more apps)
     */
    function calculateNextTokenId(uint256 currentTokenId) internal view returns (uint256) {
        return (currentTokenId <= _totalTokens) ? currentTokenId : 0;
    }

    /**
     * @dev Returns applications with a specific status, starting from a given token ID
     * @param startFromTokenId The token ID to start from (1 for first call)
     * @param status The status to filter by
     * @return apps Array of App structs
     * @return nextTokenId The next token ID to use for the next call (0 if no more apps)
     */
    function getAppsByStatus(uint256 startFromTokenId, AppStatus status) public view returns (App[] memory apps, uint256 nextTokenId) {
        // Return empty array if no tokens exist or start token ID is out of bounds
        if (_totalTokens == 0 || startFromTokenId == 0 || startFromTokenId > _totalTokens) {
            return (new App[](0), 0);
        }
        
        App[] memory tempApps = new App[](MAX_APPS_PER_PAGE);
        uint256 returnIndex = 0;
        uint256 currentTokenId = startFromTokenId;
        
        while (currentTokenId <= _totalTokens && returnIndex < MAX_APPS_PER_PAGE) {
            if (_apps[currentTokenId].status == status) {
                tempApps[returnIndex] = _apps[currentTokenId];
                returnIndex++;
            }
            currentTokenId++;
        }
        
        // Create new array with exact size needed and copy matching apps
        if (returnIndex == MAX_APPS_PER_PAGE) {
            apps = tempApps;
        } else {
            apps = new App[](returnIndex);
            for (uint256 i = 0; i < returnIndex; i++) {
                apps[i] = tempApps[i];
            }
        }
        
        // Continue pagination if we've filled the page and haven't reached the end
        nextTokenId = calculateNextTokenId(currentTokenId);
        return (apps, nextTokenId);
    }

   /**
     * @dev Returns active applications, starting from a given token ID
     * @param startFromTokenId The token ID to start from (1 for first call)
     * @return apps Array of App structs
     * @return nextTokenId The next token ID to use for the next call (0 if no more apps)
     */
    function getApps(uint256 startFromTokenId) public view returns (App[] memory apps, uint256 nextTokenId) {
        return getAppsByStatus(startFromTokenId, AppStatus.ACTIVE);
    }

    /**
     * @dev Returns paginated DIDs with a specific status
     * @param startFromTokenId The token ID to start from (1 for first call)
     * @param status The status to filter by
     * @return dids Array of DIDs
     * @return nextTokenId The next token ID to use for the next call (0 if no more apps)
     */
    function getAppDIDsByStatus(uint256 startFromTokenId, AppStatus status) public view returns (string[] memory dids, uint256 nextTokenId) {
        // Return empty array if no tokens exist or start token ID is out of bounds
        if (_totalTokens == 0 || startFromTokenId == 0 || startFromTokenId > _totalTokens) {
            return (new string[](0), 0);
        }
        
        string[] memory tempDIDs = new string[](MAX_DIDS_PER_PAGE);
        uint256 returnIndex = 0;
        uint256 currentTokenId = startFromTokenId;
        
        while (currentTokenId <= _totalTokens && returnIndex < MAX_DIDS_PER_PAGE) {
            if (_apps[currentTokenId].status == status) {
                tempDIDs[returnIndex] = _apps[currentTokenId].did;
                returnIndex++;
            }
            currentTokenId++;
        }
        
        if (returnIndex == MAX_DIDS_PER_PAGE) {
            dids = tempDIDs;
        } else {
            dids = new string[](returnIndex);
            for (uint256 i = 0; i < returnIndex; i++) {
                dids[i] = tempDIDs[i];
            }
        }
        
        // Continue pagination if we've filled the page and haven't reached the end
        nextTokenId = calculateNextTokenId(currentTokenId);
        return (dids, nextTokenId);
    }

    /**
     * @dev Returns paginated application DIDs
     * @param startFromTokenId The token ID to start from (1 for first call)
     * @return dids Array of DIDs
     * @return nextTokenId The next token ID to use for the next call (0 if no more apps)
     */
    function getAppDIDs(uint256 startFromTokenId) public view returns (string[] memory dids, uint256 nextTokenId) {
        return getAppDIDsByStatus(startFromTokenId, AppStatus.ACTIVE);
    }

    /**
     * @dev Returns the total number of applications
     * @return The total number of applications
     */
    function getTotalApps() public view returns (uint256) {
        return _totalTokens;
    }

    /**
     * @dev Returns all applications minted by a specific address
     * @param minter The address of the minter
     * @return Array of App structs
     */
    function getAppsByMinter(address minter) public view returns (App[] memory) {
        uint256[] memory tokenIds = _minterToTokenIds[minter];
        App[] memory apps = new App[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            apps[i] = _apps[tokenIds[i]];
        }
        
        return apps;
    }

    /**
     * @dev Returns a specific application by DID
     * @param did The DID of the application
     * @return The App struct containing all fields
     */
    function getApp(string memory did) public view returns (App memory) {
        uint256 tokenId = _didToTokenId[did];
        require(tokenId != 0, string(abi.encodePacked(ERROR_PREFIX, "Application does not exist")));
        return _apps[tokenId];
    }

    /**
     * @dev Returns a W3C compliant DID Document for a given DID
     * @param did The DID to look up
     * @return The DID Document as a JSON string
     */
    function getDIDDocument(string memory did) public view returns (string memory) {
        App memory app = getApp(did);
        return formatDIDDocument(app);
    }

    /**
     * @dev Utility function to format an App struct as a DID Document
     * @param app The App struct to format
     * @return The DID Document as a JSON string
     */
    function formatDIDDocument(App memory app) internal pure returns (string memory) {
        // Start with basic properties
        string memory document = string(abi.encodePacked(
            '{"@context":"https://www.w3.org/ns/did/v1"',
            ',"id":"', app.did, '"',
            ',"name":"', bytes32ToString(app.name), '"',
            ',"version":"', bytes32ToString(app.version), '"',
            ',"status":', uint256(app.status).toString(),
            ',"minter":"', toLowerHexString(app.minter), '"'
        ));
        
        // Add service endpoints
        document = string(abi.encodePacked(
            document,
            ',"service":[',
            '{"id":"#data","type":"URL","serviceEndpoint":"', app.dataUrl, '"}',
            ',{"id":"#iwpsPortal","type":"URL","serviceEndpoint":"', app.iwpsPortalUri, '"}',
            ',{"id":"#agentApi","type":"URL","serviceEndpoint":"', app.agentApiUri, '"}',
            ']'
        ));
        
        // Add verification method if contract exists
        if (app.hasContract) {
            document = string(abi.encodePacked(
                document,
                ',"verificationMethod":[',
                '{"id":"', app.did, '#contract"',
                ',"type":"EcdsaSecp256k1VerificationKey2019"',
                ',"controller":"', app.did, '"',
                ',"publicKeyMultibase":"', app.contractAddress, '"}',
                ']'
            ));
        }
        
        // Close the JSON object
        document = string(abi.encodePacked(document, '}'));
        
        return document;
    }

    /**
     * @dev Convert bytes32 to string using OpenZeppelin's approach
     * @param _bytes32 The bytes32 to convert
     * @return The string representation
     */
    function bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        // If the bytes32 value is empty, return an empty string
        if (_bytes32 == bytes32(0)) {
            return "";
        }
        
        // Convert to bytes and find the length (first null byte)
        bytes memory bytesValue = abi.encodePacked(_bytes32);
        uint256 length = 0;
        
        // Find string length (position of first 0 byte)
        for (uint256 i = 0; i < 32; i++) {
            if (bytesValue[i] == 0) {
                length = i;
                break;
            }
            if (i == 31) {
                length = 32; // No null terminator found
            }
        }
        
        // Create a properly sized bytes array
        bytes memory resultBytes = new bytes(length);
        
        // Copy only the valid bytes
        for (uint256 i = 0; i < length; i++) {
            resultBytes[i] = bytesValue[i];
        }
        
        return string(resultBytes);
    }

    /**
     * @dev Override _update to make apps soulbound (non-transferable)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        // Only allow minting (auth == address(0))
        require(auth == address(0), string(abi.encodePacked(ERROR_PREFIX, "Apps are soulbound and cannot be transferred or burned")));
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Convert address to lowercase hexadecimal string
     * @param addr The address to convert
     * @return The lowercase hexadecimal string representation (0x prefix + 40 lowercase chars)
     */
    function toLowerHexString(address addr) internal pure returns (string memory) {
        // OpenZeppelin's toHexString already produces lowercase output
        return Strings.toHexString(uint256(uint160(addr)), 20);
    }

}

