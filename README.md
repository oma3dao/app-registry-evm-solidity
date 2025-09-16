# OMA3 Application Registry - EVM/Solidity

A production-ready ERC721-based registry with semantic versioning, efficient querying, and comprehensive metadata management.

This repository implements the Application Registry actor described in the Inter World Portaling System specification for identity.

## ⚠️ Deployment Security Notice

**DEVELOPMENT ONLY**: The Hardhat deployment tasks in this repository are for development and testing purposes only.

**FOR PRODUCTION**: Use [Thirdweb Dashboard](https://thirdweb.com/contracts/deploy) for secure mainnet and production testnet deployments to eliminate supply chain attack risks.

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

## Architecture Overview

The OMA3 system consists of two main components working together:

### **OMA3AppRegistry** - Application Registration & NFT Management
An ERC721 contract where each token represents a unique (DID, major version) combination. This design enables:

- **Semantic Versioning**: Full semver support (major.minor.patch) with controlled upgrade paths
- **ERC721 Compatibility**: Standard NFT interfaces for marketplace integration and ownership management
- **Efficient Queries**: Optimized storage layout for fast lookups by status, owner, and keywords
- **Gas Optimization**: Packed structs and efficient array operations
- **Extensible Design**: Future-proof architecture supporting new interface types and algorithms

### **OMA3ResolverWithStore** - OMATrust DID Ownership & Data Integrity System
A resolver contract that provides the foundation for decentralized identity and trust management:

- **DID Ownership Resolution**: Authoritative determination of who controls a DID
- **Data Hash Attestation**: Cryptographic proof of data integrity for app manifests
- **Issuer Authorization**: Allowlist of trusted attestation providers
- **EIP-712 Delegated Operations**: Secure off-chain signature-based attestations
- **Maturation Windows**: 48-hour maturation period for ownership changes to prevent attacks
- **Future-Proof Interfaces**: Stable interfaces designed for long-term compatibility with future hub systems

### **Integration Model: Attestation-First Development**

**🔒 Security Requirement**: Developers must obtain DID ownership attestations before registering applications in the registry. This ensures only legitimate DID controllers can mint applications for their identities.

**Workflow**:
1. Developer obtains DID ownership and DataURL attestations from authorized issuer
2. Resolver validates ownership and DataURL during application minting
3. Registry mints ERC721 token for verified (DID, major version) combination
4. Ongoing DataURL integrity validated through resolver's attestation system

## Core Concepts

### OMATrust System - DID Ownership & Data Integrity

The OMATrust system provides the foundational trust layer for the OMA3 ecosystem:

#### **DID Ownership Resolution**
- **Decentralized Identifiers (DIDs)**: Globally unique identifiers controlled by cryptographic keys
- **Ownership Attestations**: Cryptographic proofs linking DIDs to controlling wallet addresses
- **Authorized Issuers**: Allowlisted entities that can create valid ownership attestations
- **Maturation Period**: 48-hour delay for ownership changes to prevent malicious takeovers

#### **Data Hash Attestation System**
- **Data Integrity**: Cryptographic hashes proving the authenticity of application manifests
- **Immediate Validation**: Data attestations are valid immediately (no maturation period)
- **Issuer Authorization**: Only authorized issuers can attest to data hash validity
- **Ephemeral Storage**: Focused on current validity rather than historical records

#### **Permanent Interfaces for Future Compatibility**
The resolver implements stable interfaces designed for long-term compatibility:

- **`IOMA3Resolver`**: Core resolution functions (`currentOwner`, `isDataHashValid`)
- **`IOMA3DidOwnershipAttestationStore`**: DID ownership management with EIP-712 support
- **`IOMA3DataUrlAttestationStore`**: Data integrity attestation management

These interfaces ensure smooth migration to future hub systems that may store both on-chain and off-chain attestations.

### Applications and Versioning

- **DID (Decentralized Identifier)**: Immutable unique identifier for an application, validated through OMATrust
- **Major Versions**: Breaking changes require new NFT (new token ID)
- **Minor Versions**: Backward-compatible interface additions
- **Patch Versions**: Backward-compatible bug fixes and metadata updates

### Token Structure

Each ERC721 token represents one major version of an application:
- Token ID maps to (DID, major version)
- Multiple major versions of same DID = multiple NFTs
- Owner can mint new major versions but not modify immutable fields

### Key Features

#### **Registry Features**
- **Interface Bitmap**: Supports human, API, and MCP interfaces (combinable)
- **Status Management**: Active, deprecated, or replaced applications
- **Keyword Tagging**: Hash-based keyword system for discoverability
- **Off-chain Data**: URL + hash for integrity verification through OMATrust
- **Registration Tracking**: Block/timestamp tracking for event log queries
- **Optional Metadata Storage**: Integrate with OMA3AppMetadata for on-chain JSON storage

#### **OMATrust Security Features**
- **DID Ownership Validation**: Ensures only legitimate DID controllers can register applications
- **Data Integrity Verification**: Cryptographic proof of application manifest authenticity  
- **Authorized Issuer Network**: Decentralized trust through multiple authorized attestation providers
- **Attack Prevention**: Maturation windows and replay protection prevent malicious ownership changes
- **EIP-712 Compliance**: Industry-standard signature verification for off-chain operations

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

**🔒 OMATrust Security Integration**: Before minting succeeds, the registry validates:

1. **DID Ownership**: Caller must have valid ownership attestation for the DID via `OMA3ResolverWithStore.currentOwner()`
2. **Data Integrity**: The `dataHash` must be attested as valid via `OMA3ResolverWithStore.isDataHashValid()`  
3. **Issuer Authorization**: Only developers with attestations from authorized issuers can mint

**Prerequisites for Developers**:
1. Obtain DID ownership attestation from an authorized issuer
2. Ensure your application manifest data hash is attested by an authorized issuer
3. Wait for maturation period (48 hours) if ownership recently changed

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

#### **OMA3AppRegistry** (ERC721 Application Registry)
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0x1a58589a9989C7E84128938Af06ede00593cFE31  // 0xE2d601F18166F6632f80d2Fa0Ab474B6d251D400
- **Legacy Contract Address**: 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83

#### **OMA3AppMetadata** (On-chain JSON Storage)
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0x24B0B17adb13DB2146995480e0114b2c93Df217f 
- **Legacy Contract Address**: 0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9

#### **OMA3ResolverWithStore** (OMATrust DID & Data Validation)
- **Network**: Celo Alfajores Testnet  
- **Contract Address**: [TO BE DEPLOYED - See deployment instructions below]
- **Purpose**: DID ownership resolution and data hash attestation validation

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

### Testing the Contract System

#### **Registry Testing**

1. Change the MAX_APPS_PER_PAGE to 4 for testing by modifying the contract:
   ```solidity
   uint256 private constant MAX_APPS_PER_PAGE = 4; // Maximum apps to return per query
   //uint256 private constant MAX_APPS_PER_PAGE = 100; // Maximum apps to return per query
   ```

2. Compile
   ```bash
   npx hardhat compile
   ```

3. Run registry tests
   ```bash
   npx hardhat test test/OMA3AppRegistry.ts
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

#### **OMATrust Resolver Testing**

The OMATrust resolver system includes comprehensive test suites:

##### **🚀 Automated Test Runner (Recommended)**

Use the convenient test runner script for organized testing with clear progress reporting:

```bash
# Show all available test configurations
npx ts-node scripts/run-resolver-tests.ts

# Run all resolver tests
npx ts-node scripts/run-resolver-tests.ts all

# Run specific test categories
npx ts-node scripts/run-resolver-tests.ts core         # Core functionality only
npx ts-node scripts/run-resolver-tests.ts integration  # Integration tests only
npx ts-node scripts/run-resolver-tests.ts deployment   # Deployment tests
npx ts-node scripts/run-resolver-tests.ts issuers      # Issuer management
npx ts-node scripts/run-resolver-tests.ts ownership    # Ownership attestations
npx ts-node scripts/run-resolver-tests.ts data         # Data hash attestations
npx ts-node scripts/run-resolver-tests.ts delegated    # EIP-712 delegated ops
npx ts-node scripts/run-resolver-tests.ts gas          # With gas reporting
npx ts-node scripts/run-resolver-tests.ts coverage     # With coverage
```

**Test Runner Benefits**:
- ✅ **Clear Progress**: Progress reporting with emojis and status messages
- ✅ **Organized Categories**: 13 pre-configured test categories
- ✅ **Error Handling**: Helpful error messages and configuration validation
- ✅ **Gas & Coverage**: Built-in support for gas reporting and coverage analysis

##### **Manual Test Execution**

For direct hardhat test execution:

```bash
# Run all resolver tests manually
npx hardhat test test/OMA3ResolverWithStore.ts test/OMA3ResolverIntegration.ts

# Run specific test categories with grep
npx hardhat test test/OMA3ResolverWithStore.ts --grep "Deployment"
npx hardhat test test/OMA3ResolverWithStore.ts --grep "Issuer Authorization"
npx hardhat test test/OMA3ResolverWithStore.ts --grep "EIP-712 Delegated"

# Run with gas reporting
REPORT_GAS=true npx hardhat test test/OMA3ResolverWithStore.ts
```

**Test Coverage**:
- ✅ **28+ Core Tests**: Deployment, access control, attestations
- ✅ **Integration Tests**: Complex scenarios and time-based testing  
- ✅ **Security Tests**: EIP-712 signatures, replay protection, access control
- ✅ **Edge Cases**: Expiry handling, maturation windows, error conditions

See `test/README.md` for detailed testing guide and `test/TESTING_SUMMARY.md` for current status.

### Deploying the Contract

## ⚠️ CRITICAL: Development vs Production Deployment

### For Development/Testing ONLY:

Use the Hardhat tasks for local development and testing:

1. **Setup environment**:
   ```bash
   # Install dependencies
   npm install
   
   # Create private key file for development
   mkdir -p ~/.ssh
   echo "PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key
   chmod 600 ~/.ssh/test-evm-deployment-key
   ```

### For Production/Mainnet:

**🚨 DO NOT USE HARDHAT TASKS FOR PRODUCTION 🚨**

Use [Thirdweb Dashboard](https://thirdweb.com/contracts/deploy) instead:

1. **Compile contracts**: `npm run compile`
2. **Upload to Thirdweb Dashboard**: Use the compiled artifacts from `artifacts/contracts/`
3. **Deploy securely**: Through Thirdweb's secure infrastructure
4. **Verify deployment**: Using dashboard tools

**Why Thirdweb for Production?**
- ✅ Eliminates supply chain attack risks
- ✅ Secure remote execution environment  
- ✅ Professional security infrastructure
- ✅ Hardware wallet support via WalletConnect
- ✅ No local private key exposure

### Production Deployment with Factory Contract

For production, use the `OMA3SystemFactory` contract for secure deployment:

1. **Prepare deployment**:
   ```bash
   npm run prepare:factory
   ```

2. **Deploy via Thirdweb Dashboard**:
   - Upload `artifacts/contracts/OMA3SystemFactory.sol/OMA3SystemFactory.json`
   - Deploy the factory (no constructor parameters needed)
   - Call `deploySystem(0)` to deploy both contracts with linking
   - Note the registry and metadata addresses from the deployment event

**Factory Benefits**:
- ✅ **Atomic deployment** - Both contracts deployed and linked in one transaction
- ✅ **Deterministic addresses** - Predictable contract addresses  
- ✅ **No circular dependency** - Factory handles the linking automatically
- ✅ **Ownership transfer** - You become the owner of both contracts
- ✅ **Minimal audit surface** - Simple factory logic, focus audit on main contracts

## Development Deployment Instructions

### ⚠️ DEVELOPMENT ONLY - NOT FOR PRODUCTION

The following instructions are for **development and testing purposes only**. 

**For production deployments, use [Thirdweb Dashboard](https://thirdweb.com/contracts/deploy).**

### Development Private Key Setup

For development testing, you need a private key file:

```bash
# Create development private key file (use a test key, not your real funds!)
mkdir -p ~/.ssh
echo "PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key
chmod 600 ~/.ssh/test-evm-deployment-key
```

### Development Deployment Commands

**Deploy to testnet for development**:

   ```bash
   # Deploy both Registry and Metadata contracts with linking
   npm run deploy:system -- --network celoAlfajores
   
   # Or deploy just the Registry contract
   npm run deploy:registry -- --network celoAlfajores
   ```

**Verify contracts on explorer** (optional):
   ```bash
   # Set API key 
   export CELOSCAN_API_KEY=your_api_key_here

   # Verify contracts using addresses from deployment output
   npx hardhat verify --network celoAlfajores <REGISTRY_ADDRESS>
   npx hardhat verify --network celoAlfajores <METADATA_ADDRESS>
   ```

### Important Development Notes

- ⚠️ **Development only**: These commands are for testing and development
- ⚠️ **Use test funds**: Don't use real funds for development deployments  
- ⚠️ **Production warning**: Never use these commands for mainnet or production testnets
- ✅ **For production**: Use [Thirdweb Dashboard](https://thirdweb.com/contracts/deploy) instead

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

### **🌐 Frontend Applications (Recommended for Most Developers)**

For 99% of developers, use the web applications instead of coding directly:

#### **Application Registration**
**🚀 [appregistry.oma3.org](https://appregistry.oma3.org)**
- **User-friendly interface** for registering and managing OMA3 applications
- **Visual workflow** for DID attestation and application minting
- **Guided process** ensures all OMATrust requirements are met
- **No coding required** - just fill out forms and connect your wallet

#### **Reputation & Attestations**  
**⭐ [reputation.oma3.org](https://reputation.oma3.org)**
- **Create attestations** for DID ownership and data integrity
- **Manage reputation** and extended attestations via EAS integration
- **Issuer interface** for authorized attestation providers
- **Community tools** for reviews, endorsements, and certifications

#### **Why Use the Frontend?**
- ✅ **No technical knowledge required** - intuitive web interface
- ✅ **Automatic validation** - ensures all requirements are met
- ✅ **Integrated workflow** - handles OMATrust attestations seamlessly  
- ✅ **Real-time feedback** - immediate error checking and guidance
- ✅ **Mobile friendly** - works on all devices
- ✅ **Community features** - discover and interact with other developers

---

### **💻 Programmatic Integration (Advanced Users)**

For developers who need programmatic access or custom integrations, refer to the code examples below and the [app-registry-evm-solidity GitHub repository](https://github.com/oma3dao/app-registry-evm-solidity) for complete implementation details.

### **JavaScript/Web3 Integration**

> **💡 Note**: Most developers should use [appregistry.oma3.org](https://appregistry.oma3.org) instead of coding directly. The examples below are for advanced programmatic integration.

#### **Complete Integration: OMATrust + Registry**

```javascript
// 1. First, ensure you have OMATrust attestations
const resolver = new ethers.Contract(resolverAddress, resolverABI, signer);
const registry = new ethers.Contract(registryAddress, registryABI, signer);

// Check if you have valid DID ownership
const didHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("did:example:123"));
const currentOwner = await resolver.currentOwner(didHash);

if (currentOwner !== signerAddress) {
  throw new Error("You must have DID ownership attestation before minting");
}

// Check if your data hash is attested
const metadataContent = JSON.stringify({
  name: "My Gaming App",
  description: "A Web3 gaming application",
  icon: "https://example.com/icon.png"
});
const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(metadataContent));
const isDataValid = await resolver.isDataHashValid(didHash, dataHash);

if (!isDataValid) {
  throw new Error("Your data hash must be attested by an authorized issuer");
}

// 2. Now you can mint the application
const interfaces = 5; // 1 (human) + 4 (mcp) = human + mcp interfaces
const keywordHashes = [
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("gaming")),
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("web3"))
];

const tx = await registry.mint(
  "did:example:123",           // DID (must match your attestation)
  interfaces,                  // Interface bitmap
  "ipfs://QmHash...",          // Data URL
  dataHash,                    // Data hash (must be attested)
  0,                          // keccak256 algorithm
  "",                         // No fungible token
  "",                         // No contract
  1,                          // Major version 1
  0,                          // Minor version 0
  0,                          // Patch version 0
  keywordHashes,              // Keywords
  metadataContent             // Optional: store JSON on-chain
);

console.log("Application minted successfully:", tx.hash);
```

#### **Getting OMATrust Attestations**

```javascript
// For authorized issuers to create attestations
const resolver = new ethers.Contract(resolverAddress, resolverABI, issuerSigner);

// 1. Attest DID ownership
const controllerBytes32 = ethers.utils.zeroPad(developerAddress, 32);
const expiresAt = 0; // Non-expiring
await resolver.upsertDirect(didHash, controllerBytes32, expiresAt);

// 2. Attest data hash
const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(metadataContent));
await resolver.attestDataHash(didHash, dataHash, expiresAt);

console.log("Attestations created for developer");
```

#### **Beyond Core Trust: Extended Attestations**

The resolver contract only handles **DID ownership** and **data URL integrity**. For other OMATrust attestations (cybersecurity audits, user reviews, reputation scores, etc.):

- **Frontend**: Use **[reputation.oma3.org](https://reputation.oma3.org)** for user-friendly attestation management
- **Technical Details**: See [rep-attestation-tools-evm-solidity](https://github.com/oma3dao/rep-attestation-tools-evm-solidity) and [rep-attestation-frontend](https://github.com/oma3dao/rep-attestation-frontend) repositories
- **Technology**: Built on proven attestation services (EAS, BAS, etc.) on various chains

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

## Ecosystem Integration & Future Migration

### **Proven Attestation Service Integration**

For attestations beyond core DID ownership and data integrity, the OMA3 ecosystem integrates with proven attestation services such as [EAS (Ethereum Attestation Service)](https://attest.sh/) and [BAS (Base Attestation Service)](https://github.com/base-org/bas) deployed on various chains:

#### **Index Function: DID → Recipient Mapping**
```solidity
// Helper function for EAS integration
function didToRecipient(string memory didString) public pure returns (bytes32) {
    return keccak256(abi.encodePacked("did:", didString));
}
```

**Usage Pattern**:
- **Core Trust**: OMATrust resolver handles DID ownership and data integrity
- **Extended Attestations**: Use proven attestation services (EAS, BAS, etc.) for reputation, certifications, endorsements, reviews, etc.
- **Indexing**: Use `didToRecipient(did)` as the recipient field in attestation services
- **Discovery**: Query attestation services by recipient to find all attestations for a DID

#### **Examples of Extended Attestations**:
- **Reputation Scores**: Developer track record and community standing
- **Security Audits**: Third-party security assessment results
- **User Reviews**: Community feedback and ratings
- **Compliance Certifications**: Regulatory or industry standard compliance
- **Integration Approvals**: Platform-specific authorization attestations

### **Future Hub Migration Path**

The OMATrust resolver system is designed for seamless migration to future hub systems:

#### **Stable Interface Guarantee**
The resolver implements permanent interfaces that will be maintained across all future versions:
- `IOMA3Resolver` - Core resolution functions
- `IOMA3DidOwnershipAttestationStore` - Ownership management  
- `IOMA3DataUrlAttestationStore` - Data integrity validation

#### **Hub System Evolution**
```
Current: OMA3ResolverWithStore (On-chain only)
    ↓
Future: OMA3Hub (Hybrid on-chain + off-chain)
    ↓  
Advanced: OMA3FederatedHub (Multi-chain + decentralized storage)
```

**Migration Benefits**:
- ✅ **Zero Downtime**: New hubs implement same interfaces
- ✅ **Backward Compatibility**: Existing integrations continue working
- ✅ **Enhanced Features**: Access to off-chain attestations, multi-chain support
- ✅ **Gradual Migration**: Migrate at your own pace, no forced upgrades
- ✅ **Data Preservation**: All existing attestations preserved and accessible

#### **Future Hub Capabilities**
- **Hybrid Storage**: Both on-chain and off-chain attestation support
- **Multi-chain Resolution**: Cross-chain DID ownership and attestation validation
- **Decentralized Storage**: IPFS, Arweave, and other decentralized storage integration
- **Advanced Queries**: Complex attestation discovery and filtering
- **Federation**: Inter-hub communication and attestation sharing

### **Developer Integration Strategy**

**Recommended Approach**:
1. **Build on Interfaces**: Always use `IOMA3Resolver` interface, never direct contract calls
2. **Plan for Hybrid**: Design systems to handle both on-chain and off-chain attestations
3. **Index with EAS**: Use EAS for extended attestations with DID-based indexing
4. **Stay Updated**: Monitor for hub system announcements and migration guides

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
