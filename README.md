# OMA3 Application Registry - EVM/Solidity

A production-ready ERC721-based registry with semantic versioning, efficient querying, and comprehensive metadata management.

This repository implements the Application Registry actor described in the Inter World Portaling System specification for identity.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

## Architecture Overview

The OMA3AppRegistry is an ERC721 contract where each token represents a unique (DID, major version) combination. This design enables:

- **Semantic Versioning**: Full semver support (major.minor.patch) with controlled upgrade paths
- **ERC721 Compatibility**: Standard NFT interfaces for marketplace integration and ownership management
- **Efficient Queries**: Optimized storage layout for fast lookups by status, owner, and keywords
- **Gas Optimization**: Packed structs and efficient array operations
- **Extensible Design**: Future-proof architecture supporting new interface types and algorithms

## Core Concepts

### Applications and Versioning

- **DID (Decentralized Identifier)**: Immutable unique identifier for an application
- **Major Versions**: Breaking changes require new NFT (new token ID)
- **Minor Versions**: Backward-compatible interface additions
- **Patch Versions**: Backward-compatible bug fixes and metadata updates

### Token Structure

Each ERC721 token represents one major version of an application:
- Token ID maps to (DID, major version)
- Multiple major versions of same DID = multiple NFTs
- Owner can mint new major versions but not modify immutable fields

### Key Features

- **Interface Bitmap**: Supports human, API, and MCP interfaces (combinable)
- **Status Management**: Active, deprecated, or replaced applications
- **Keyword Tagging**: Hash-based keyword system for discoverability
- **Off-chain Data**: URL + hash for integrity verification
- **Registration Tracking**: Block/timestamp tracking for event log queries
- **Optional Metadata Storage**: Integrate with OMA3AppMetadata for on-chain JSON storage

## Smart Contract API

### Core Functions

#### Minting Applications

```solidity
function mint(
    string memory didString,           // Unique DID identifier
    uint16 interfaces,                 // Interface bitmap (1=human, 2=api, 4=mcp)
    string memory dataUrl,             // URL to off-chain metadata
    bytes32 dataHash,                  // Hash of off-chain data
    uint8 dataHashAlgorithm,           // Hash algorithm (0=keccak256, 1=sha256)
    string memory fungibleTokenId,     // CAIP-19 token ID (optional)
    string memory contractId,          // CAIP-10 contract address (optional)
    uint8 initialVersionMajor,         // Initial major version
    uint8 initialVersionMinor,         // Initial minor version
    uint8 initialVersionPatch,         // Initial patch version
    bytes32[] memory keywordHashes,    // Keyword hashes for tagging
    string memory metadataJson         // Optional: JSON to store on-chain via metadata contract
) external nonReentrant returns (uint256 tokenId)
```

**Note**: The `metadataJson` parameter is optional. If provided and a metadata contract is configured, the JSON will be stored on-chain for guaranteed availability. If empty or no metadata contract is set, only the `dataUrl` and `dataHash` are used for off-chain metadata reference.

#### Updating Applications

```solidity
function updateAppControlled(
    string memory didString,
    uint8 major,
    string memory newDataUrl,          // New data URL (empty = no change)
    bytes32 newDataHash,               // New data hash (bytes32(0) = no change)
    uint8 newDataHashAlgorithm,        // New hash algorithm
    uint16 newInterfaces,              // New interfaces (0 = no change)
    bytes32[] memory newKeywordHashes, // New keywords (empty = no change)
    uint8 newMinor,                    // New minor version
    uint8 newPatch                     // New patch version
) external onlyAppOwner(didString, major) nonReentrant
```

#### Status Management

```solidity
function updateStatus(
    string memory didString,
    uint8 major,
    uint8 newStatus                    // 0=active, 1=deprecated, 2=replaced
) external onlyAppOwner(didString, major) nonReentrant
```

#### Metadata Contract Integration

```solidity
function setMetadataContract(address _metadataContract) external onlyOwner

function setMetadataJson(
    string memory didString,
    uint8 major,
    string memory metadataJson,
    bytes32 dataHash,
    uint8 dataHashAlgorithm
) external onlyAppOwner(didString, major) nonReentrant
```

**Metadata Storage Options:**
- **Off-chain**: Use IPFS, Arweave, HTTP endpoints, or data URIs (most common)
- **On-chain**: Optionally store JSON in the metadata contract for guaranteed availability

### Query Functions

#### Get Application Data

```solidity
function getApp(string memory didString, uint8 major) 
    external view returns (App memory)

function getDIDByTokenId(uint256 tokenId) 
    external view returns (string memory)

function latestMajor(bytes32 didHash) 
    external view returns (uint8)
```

#### Pagination and Listing

```solidity
function getAppsByStatus(uint8 status, uint256 startIndex) 
    external view returns (App[] memory apps, uint256 nextStartIndex)

function getAppsByMinter(address minter, uint256 startIndex) 
    external view returns (App[] memory apps, uint256 nextStartIndex)

function getApps(uint256 startIndex) 
    external view returns (App[] memory apps, uint256 nextStartIndex)

function getTotalAppsByStatus(uint8 status) 
    external view returns (uint256)

function getTotalAppsByMinter(address minter) 
    external view returns (uint256)
```

**Important**: 
- **Token IDs** start from 1 (first minted app has token ID 1)
- **Pagination indices** start from 0 (use `startIndex = 0` for the first page)
- These are separate numbering systems - pagination index refers to position in result arrays, not token IDs

**Example**: If you have 3 minted apps with token IDs [1, 2, 3]:
- `getAppsByMinter(minter, 0)` returns apps at positions 0-2 (all 3 apps)
- `getAppsByMinter(minter, 1)` returns apps at positions 1-2 (apps with token IDs 2, 3)
- The apps themselves still have token IDs 1, 2, 3 regardless of pagination

#### Keyword Filtering

```solidity
function hasAnyKeywords(string memory didString, uint8 major, bytes32[] memory keywords) 
    external view returns (bool)

function hasAllKeywords(string memory didString, uint8 major, bytes32[] memory keywords) 
    external view returns (bool)
```

### Versioning Rules

The contract enforces semantic versioning rules:

1. **Interface Changes**: Require minor version increment and must be additive only
2. **Data/Keyword Changes**: Require patch increment (unless minor also increments)
3. **Major Version Changes**: Require minting new NFT with new token ID
4. **Immutable Fields**: DID, major version, minter, fungible token ID, contract ID

### Events

```solidity
event AppMinted(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                address minter, uint16 interfaces, uint256 registrationBlock, uint256 registrationTimestamp);
event StatusUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                    uint8 newStatus, uint256 timestamp);
event DataUrlUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                     string newDataUrl, bytes32 newDataHash, uint8 dataHashAlgorithm);
event VersionAdded(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                   uint8 minor, uint8 patch);
event KeywordsUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                      bytes32[] newKeywordHashes);
event InterfacesUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                        uint16 newInterfaces);
```

## Deployment and Interaction Guide

### Current Deployment

The OMA3AppRegistry contract is currently deployed on the Celo Alfajores testnet:
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0xE2d601F18166F6632f80d2Fa0Ab474B6d251D400 
- **Legacy Contract Addres**: 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83

### Contract ABI

The contract ABI is generated automatically when you compile the contracts and can be found at:

```
artifacts/contracts/OMA3AppRegistry.sol/OMA3AppRegistry.json
```

You can extract just the ABI portion for use in your frontend applications:

```bash
# Using jq (if installed)
jq .abi artifacts/contracts/OMA3AppRegistry.sol/OMA3AppRegistry.json > oma3app-registry-abi.json

# Or manually open the file and copy the "abi" array
```

### Testing the Contract

1. Change the MAX_APPS_PER_PAGE to 4 for testing by modifying the contract:
   ```solidity
   uint256 private constant MAX_APPS_PER_PAGE = 4; // Maximum apps to return per query
   //uint256 private constant MAX_APPS_PER_PAGE = 100; // Maximum apps to return per query
   ```

2. Compile
   ```bash
   npx hardhat compile
   ```

3. Run tests
   ```bash
   npx hardhat test
   ```

4. Change the MAX_APPS_PER_PAGE back to production values:
   ```solidity
   //uint256 private constant MAX_APPS_PER_PAGE = 4; // Maximum apps to return per query
   uint256 private constant MAX_APPS_PER_PAGE = 100; // Maximum apps to return per query
   ```

5. Compile again
   ```bash
   npx hardhat compile
   ```

### Deploying the Contract

1. **Setup environment**:
   ```bash
   # Install dependencies
   npm install
   
   # Private key is loaded automatically from ~/.ssh/test-evm-deployment-key
   # Accepted formats (one line):
   #   - PRIVATE_KEY=0x<64-hex>
   #   - <64-hex> (raw, without 0x) 
   # The loader normalizes to 0x-prefixed hex and validates length/charset.

   # Create the SSH key file if it doesn't exist
   mkdir -p ~/.ssh
   # Option A: env-style
   echo "PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key
   # Option B: raw hex (no 0x)
   # echo "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key

   # Secure permissions
   chmod 600 ~/.ssh/test-evm-deployment-key

## Security and Private Key Management

### Private Key Policy

This project follows a **strict security policy** for private key management:

**✅ Recommended: Secure storage and permissions**
- Private keys should be stored in `~/.ssh/test-evm-deployment-key`
- File permissions MUST be 600 (owner read/write only)
- Use a password manager or OS keychain to store the source key securely. If you encrypt the file, decrypt it to plaintext before running Hardhat (the project does not prompt for decryption).

**❌ NEVER ALLOWED: Plain text in .env files**
- No `PRIVATE_KEY=` entries in any `.env` files
- No `.env.private_key` files
- No unencrypted private key storage

### Security Setup

**⚠️ IMPORTANT: Use secp256k1 keys for EVM, not ed25519**

```bash
# 1. DO NOT generate ed25519 keys - EVM uses secp256k1
# Instead, create the SSH file directly for your existing EVM private key

# 2. Set secure permissions
chmod 600 ~/.ssh/test-evm-deployment-key*

# 3. Export your EVM private key to the SSH file
# Format: Just the hex string without '0x' prefix
# Example for a secp256k1 private key:
echo "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key

# 4. Verify the key format (should be 64 hex characters)
cat ~/.ssh/test-evm-deployment-key
# Should show: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# 5. Verify your key file exists and has correct permissions
ls -la ~/.ssh/test-evm-deployment-key
```

### Environment Variables

Only these environment variables are used:
- `PRIVATE_KEY` - Set automatically from `~/.ssh/test-evm-deployment-key`; values from `.env` files are ignored
- `REPORT_GAS` - Gas reporting toggle
- `HOME` - System variable (used to locate ~/.ssh/test-evm-deployment-key)

**Never store private keys in:**
- `.env` files
- `.env.local` files
- Repository code
- Docker containers
- CI/CD pipelines
   ```

2. **Deploy to Celo Alfajores** (only necessary to deploy a new contract):
   ```bash
   npx hardhat run scripts/deploy.ts --network celoAlfajores
   ```

3. **Verify the contract** (optional):
   ```bash
   npx hardhat verify --network celoAlfajores <CONTRACT_ADDRESS>
   ```
4. Make note of the new contract address and update other projects accordingly

### Interacting with the Contract

#### Using Hardhat Tasks

```bash
# Register a new app
npx hardhat registerApp --did "did:example:123" --interfaces 1 --dataurl "https://example.com/app" --major 1 --minor 0 --patch 0 --registry <CONTRACT_ADDRESS> --network celoAlfajores

# Get app details by DID and major version
npx hardhat getApp --did "did:example:123" --major 1 --registry <CONTRACT_ADDRESS> --network celoAlfajores

# Get all apps (paginated)  
npx hardhat getApps --start 0 --registry <CONTRACT_ADDRESS> --network celoAlfajores

# Get apps by minter
npx hardhat getAppsByMinter --minter <ADDRESS> --start 0 --registry <CONTRACT_ADDRESS> --network celoAlfajores
```

## Usage Examples

### JavaScript/Web3 Integration

#### Minting an Application

```javascript
const interfaces = 5; // 1 (human) + 4 (mcp) = human + mcp interfaces
const keywordHashes = [
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("gaming")),
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("web3"))
];

// Option 1: Off-chain metadata (IPFS/Arweave/HTTP)
const tx = await registry.mint(
  "did:example:123",           // DID
  interfaces,                  // Interface bitmap
  "ipfs://QmHash...",          // Data URL
  dataHash,                    // Data hash
  0,                          // keccak256 algorithm
  "",                         // No fungible token
  "",                         // No contract
  1,                          // Major version 1
  0,                          // Minor version 0
  0,                          // Patch version 0
  keywordHashes,              // Keywords
  ""                          // No on-chain metadata
);

// Option 2: On-chain metadata storage
const metadataJson = JSON.stringify({
  name: "My Gaming App",
  description: "A Web3 gaming application",
  icon: "https://example.com/icon.png"
});

const tx = await registry.mint(
  "did:example:123",           // DID
  interfaces,                  // Interface bitmap
  "https://api.registry.com/metadata/did:example:123", // Data URL points to registry API
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(metadataJson)), // Hash of JSON
  0,                          // keccak256 algorithm
  "",                         // No fungible token
  "",                         // No contract
  1,                          // Major version 1
  0,                          // Minor version 0
  0,                          // Patch version 0
  keywordHashes,              // Keywords
  metadataJson                // Store JSON on-chain
);
```

#### Updating an Application

```javascript
// Update data and bump patch version
await registry.updateAppControlled(
  "did:example:123",          // DID
  1,                          // Major version
  "https://example.com/v2",   // New data URL
  newDataHash,                // New data hash
  0,                          // Same algorithm
  0,                          // No interface changes
  [],                         // No keyword changes
  0,                          // Same minor
  1                           // Increment patch
);
```

#### Querying Applications

```javascript
// Get active applications (paginated)
const [apps, nextIndex] = await registry.getAppsByStatus(0, 0);

// Check if app has keywords
const hasKeywords = await registry.hasAnyKeywords(
  "did:example:123", 1, keywordHashes
);

// Get latest major version
const latest = await registry.latestMajor(
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("did:example:123"))
);
```

---

## Metadata Storage Integration

The registry supports optional integration with the OMA3AppMetadata contract for on-chain JSON storage.

### Configuration

```solidity
// Set metadata contract address (owner only)
await registry.setMetadataContract("0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9");
```

### Developer Choice

**Option A: Off-Chain Metadata (Recommended)**
```javascript
// Use IPFS, Arweave, HTTP, or data URIs
await registry.mint(did, interfaces, "ipfs://QmHash...", dataHash, 0, "", "", 1, 0, 0, [], "");
```

**Option B: On-Chain Metadata**
```javascript
// Store JSON in metadata contract
const json = JSON.stringify({name: "My App", description: "Description"});
await registry.mint(did, interfaces, dataUrl, keccak256(json), 0, "", "", 1, 0, 0, [], json);
```

### Benefits

- **Flexibility**: Choose storage method per application
- **Future-proof**: Migrate between storage methods
- **Cost-effective**: Pay for on-chain storage only when needed
- **Reliable**: Registry works with or without metadata contract

---

## Migration from V0

### Major Changes from V0

The current version represents a complete architectural redesign from the original v0 implementation:

#### **1. ERC721 Integration**
- **V0**: Custom token system with simple ID assignment
- **Current**: Full ERC721 compatibility with marketplace integration

#### **2. DID-Based Versioning**
- **V0**: Single version per DID, simple updates
- **Current**: Semantic versioning with (DID, major) uniqueness, multiple major versions as separate NFTs

#### **3. Data Structure**
- **V0**: Simple flat fields (name, version, URLs)
- **Current**: Complex structured data with version history, interface bitmaps, keyword hashes

#### **4. Query Optimization**
- **V0**: Linear searches, limited pagination
- **Current**: Optimized storage with active app indexing, efficient pagination, keyword filtering

#### **5. Interface System**
- **V0**: Separate URL fields for different interface types
- **Current**: Bitmap-based interface system (human/API/MCP) with extensibility

#### **6. Versioning Constraints**
- **V0**: No version validation or semantic constraints
- **Current**: Strict semver rules with controlled upgrade paths

#### **7. Storage Efficiency**
- **V0**: Unoptimized storage layout
- **Current**: Gas-optimized packed structs and efficient mappings

#### **8. Event System**
- **V0**: Basic events
- **Current**: Comprehensive event system with indexed fields for efficient querying

### Migration Considerations

**Breaking Changes:**
- All function signatures changed
- Data structures completely different  
- Event formats updated
- No backward compatibility with v0

**Migration Strategy:**
1. Export all v0 data before migration
2. Deploy new contract
3. Re-mint applications with new structure
4. Update all client integrations
5. Update event listeners and indexing

**Data Mapping:**
- `name` → removed (use off-chain metadata)
- `version` → split into major.minor.patch with history
- `iwpsPortalUri` → include in off-chain metadata or interface bitmap
- `agentApiUri` → include in off-chain metadata or interface bitmap  
- `contractAddress` → `contractId` (CAIP-10 format)
- Status enum → uint8 status codes
