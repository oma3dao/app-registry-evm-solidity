# OMA3 Application Registry - EVM/Solidity

**Canonical Implementation** of the [OMATrust Application Registry Specification](https://github.com/oma3dao/omatrust-docs/tree/main/specification).

A production-ready ERC721-based registry with semantic versioning, efficient querying, and comprehensive metadata management for decentralized applications in the OMA3 ecosystem.

## **License and Participation**

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

**Licensing Notice**  
This initial version (v1) is released under MIT to maximize transparency and adoption.  

OMA3 may license future versions of this reference implementation under different terms (for example, the Business Source License, BSL) if forks or incompatible implementations threaten to fragment the ecosystem or undermine the sustainability of OMA3.  

OMA3 standards (such as specifications and schemas) will always remain open and are governed by [OMA3's IPR Policy](https://www.oma3.org/intellectual-property-rights-policy).

## **Architecture Overview**

The OMA3 system consists of two main components working together:

### OMA3AppRegistry - Application Registration & NFT Management
An ERC721 contract where each token represents a unique (DID, major version) combination.  See the OMATrust specification for details.

### OMA3ResolverWithStore - OMATrust DID Ownership & Data Integrity System
A resolver contract that provides the foundation for decentralized identity and trust management.

### OMA3AppMetadata - Optional App Registry DataURL Storage
A contract that OMA3AppRegistry can use to store the dataUrl JSON object onchain.

#### Permanent Interfaces for Future Compatibility
The resolver implements stable interfaces designed for long-term compatibility:

- **`IOMA3Resolver`**: Core resolution functions (`currentOwner`, `isDataHashValid`)
- **`IOMA3DidOwnershipAttestationStore`**: DID ownership management with EIP-712 support
- **`IOMA3DataUrlAttestationStore`**: Data integrity attestation management

These interfaces ensure smooth migration to future hub systems that may store both on-chain and off-chain attestations.

## **Smart Contract Functions**

### Write Functions

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
    bytes32[] memory traitHashes,      // Trait hashes for tagging
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
    bytes32[] memory newTraitHashes,   // New traits (empty = no change)
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
- **Offchain**: Use IPFS, Arweave, HTTP endpoints, or data URIs (most common)
- **Onchain**: Optionally store JSON in the metadata contract for guaranteed availability

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

#### Trait Filtering

```solidity
function hasAnyTraits(string memory didString, uint8 major, bytes32[] memory traits) 
    external view returns (bool)

function hasAllTraits(string memory didString, uint8 major, bytes32[] memory traits) 
    external view returns (bool)
```

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
event TraitsUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                    bytes32[] newTraitHashes);
event InterfacesUpdated(bytes32 indexed didHash, uint8 indexed major, uint256 indexed tokenId, 
                        uint16 newInterfaces);
```

## **Contract ABI**

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

## **Deployment Addresses**

#### Production Deployments (OMAChain Mainnet)
- **Chain ID**:
- **RPC Endpoint**:
- **OMA3AppRegistry**: [Deployed Address Here]
- **OMA3AppMetadata**: [Deployed Address Here]
- **OMA3ResolverWithStore**: [Deployed Address Here]

#### Test Deployment (OMAChain Testnet)
- **Chain ID**:
- **RPC Endpoint**:
- **OMA3AppRegistry**: [Deployed Address Here]
- **OMA3AppMetadata**: [Deployed Address Here]
- **OMA3ResolverWithStore**: [Deployed Address Here]

#### Dev Deployment (Celo Alfajores Testnet)
- **Chain ID**:
- **RPC Endpoint**:
- **OMA3AppRegistry**: [Deployed Address Here]
- **OMA3AppMetadata**: [Deployed Address Here]
- **OMA3ResolverWithStore**: [Deployed Address Here]

## **Official Front End Websites**

For 99% of developers, use the web applications instead of coding directly:

### Application Registration
**🚀 [appregistry.oma3.org](https://appregistry.oma3.org)**
- **User-friendly interface** for registering and managing OMA3 applications
- **Visual workflow** for DID attestation and application minting
- **Guided process** ensures all OMATrust requirements are met
- **No coding required** - just fill out forms and connect your wallet

### Reputation & Attestations  
**⭐ [reputation.oma3.org](https://reputation.oma3.org)**
- **Create attestations** for DID ownership and data integrity
- **Manage reputation** and extended attestations via EAS integration
- **Issuer interface** for authorized attestation providers
- **Community tools** for reviews, endorsements, and certifications

### Why Use the Frontend?
- ✅ **No technical knowledge required** - intuitive web interface
- ✅ **Automatic validation** - ensures all requirements are met
- ✅ **Integrated workflow** - handles OMATrust attestations seamlessly  
- ✅ **Real-time feedback** - immediate error checking and guidance
- ✅ **Mobile friendly** - works on all devices
- ✅ **Community features** - discover and interact with other developers

## **💻 Programmatic Integration**

For developers who need programmatic access or custom integrations, refer to the code examples below and the [app-registry-frontend GitHub repository](https://github.com/oma3dao/app-registry-frontend) for complete implementation details.

### Registering an Application

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
const traitHashes = [
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
  traitHashes,                // Traits
  metadataContent             // Optional: store JSON on-chain
);

console.log("Application minted successfully:", tx.hash);
```

### Updating an Application

```javascript
// Update data and bump patch version
await registry.updateAppControlled(
  "did:example:123",          // DID
  1,                          // Major version
  "https://example.com/v2",   // New data URL
  newDataHash,                // New data hash
  0,                          // Same algorithm
  0,                          // No interface changes
  [],                         // No trait changes
  0,                          // Same minor
  1                           // Increment patch
);
```

### Querying Applications

```javascript
// Get active applications (paginated)
const [apps, nextIndex] = await registry.getAppsByStatus(0, 0);

// Check if app has traits
const hasTraits = await registry.hasAnyTraits(
  "did:example:123", 1, traitHashes
);

// Get latest major version
const latest = await registry.latestMajor(
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("did:example:123"))
);
```

## Getting Trust Data

The main use of OMATrust is getting trust data on an application.  

### OMATrust Attestations

Most OMATrust attestations (cybersecurity audits, user reviews, reputation scores, etc.) leverage proven attestation services such as [EAS (Ethereum Attestation Service)](https://attest.sh/) and [BAS (Base Attestation Service)](https://github.com/base-org/bas) deployed on various chains, including OMAChain.  

#### Index Function: DID → Recipient Mapping

Exising EVM attestation services index on the ethereum address of the subject (also called the attestation "recipient").  OMATrust extends these attestations services by standardizing a method to convert any DID to an Ethereum address format:

```solidity
// Helper function for EAS integration
function didToRecipient(string memory didString) public pure returns (bytes32) {
    return keccak256(abi.encodePacked("did:", didString));
}
```

**Usage Pattern**:
- **Attesting**: Issuers use the output of `didToRecipient(did)` as the recipient field when making attestations
- **Discovery**: Query attestation services by recipient to find all attestations for a DID

#### Examples of OMATrust Attestations:
- **Reputation Scores**: Developer track record and community standing
- **Security Audits**: Third-party security assessment results
- **User Reviews**: Community feedback and ratings
- **Compliance Certifications**: Regulatory or industry standard compliance
- **Integration Approvals**: Platform-specific authorization attestations

### Ownership Resolver Attestations

Ownership is checked when an application is registered.  However, clients that wish to verify ownership themselves can query the Resolver contract.  Remember that the Resolver contract only handles **DID ownership** and **data URL integrity** attestations.

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

### Future Hub Migration Path

The OMATrust resolver system is designed for seamless migration to future hub systems:

#### Stable Interface Guarantee
The resolver implements permanent interfaces that will be maintained across all future versions:
- `IOMA3Resolver` - Core resolution functions
- `IOMA3DidOwnershipAttestationStore` - Ownership management  
- `IOMA3DataUrlAttestationStore` - Data integrity validation

#### Hub System Evolution
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

#### Future Hub Capabilities
- **Hybrid Storage**: Both on-chain and off-chain attestation support
- **Multi-chain Resolution**: Cross-chain DID ownership and attestation validation
- **Decentralized Storage**: IPFS, Arweave, and other decentralized storage integration
- **Advanced Queries**: Complex attestation discovery and filtering
- **Federation**: Inter-hub communication and attestation sharing

### Developer Integration Strategy

**Recommended Approach**:
1. **Build on Interfaces**: Always use `IOMA3Resolver` interface, never direct contract calls
2. **Plan for Hybrid**: Design systems to handle both on-chain and off-chain attestations
3. **Index with EAS**: Use EAS for extended attestations with DID-based indexing
4. **Stay Updated**: Monitor for hub system announcements and migration guides

## **Production Deployment (Recommended)**

For secure production deployments, use the [Thirdweb server wallet deployment scripts](./scripts/deploy/README.md). This approach provides maximum security by eliminating private key exposure and leveraging Thirdweb's HSM infrastructure.

### **Deployment Workflow** (Hybrid: Script + Dashboard)

```bash
# Navigate to project root
cd /path/to/app-registry-evm-solidity

# 1. Create server wallet
./scripts/deploy/create-server-wallet.sh production

# 2. Upload contracts to Thirdweb (auto-compiles)
./scripts/deploy/publish-contracts.sh

# 3. Complete publishing and deployment (manual via dashboard)
# - Visit the URL from step 2 output
# - Click "Publish" for each contract to add to your profile  
# - Click "Deploy Now" for each contract
# - Select your server wallet (oma3-production-1)
# - Choose target network and deploy

Current Published Contracts:  https://thirdweb.com/contracts/publish?ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F0&ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F1&ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F2&ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F3&ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F4&ipfs=QmWc5MJLuU485XmibxfnQGSyuGQxVR3GFhhzwoEzRYYDQZ%2F5

# 4. Configure deployed contracts
./scripts/deploy/configure-contracts.sh production
```

### Security Benefits
- ✅ **No private keys exposed** - Server wallet managed by Thirdweb HSM
- ✅ **Secure credential handling** - Bitwarden integration, no secrets in code
- ✅ **Audit trail** - Complete deployment documentation
- ✅ **Production-ready** - Eliminates supply chain attack risks

*For detailed deployment instructions, see [Deployment Scripts Documentation](./scripts/deploy/README.md).* 

## **Development Deployment (Local Testing)**

⚠️ **DEVELOPMENT ONLY**: The following instructions are for local development and testing. **Never use these methods for production deployments** - use the [Thirdweb server wallet deployment](#production-deployment-recommended) instead.

For local development and testing, you can deploy contracts directly using Hardhat.

### Prerequisites

```bash
# Install dependencies
npm install

# Create development private key file (use a test key, not real funds!)
mkdir -p ~/.ssh
echo "PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key
chmod 600 ~/.ssh/test-evm-deployment-key
```

### Development Deployment Commands

```bash
# Deploy both Registry and Metadata contracts with linking
npm run deploy:system -- --network celoAlfajores

# Or deploy just the Registry contract
npm run deploy:registry -- --network celoAlfajores
```

## **Testing Deployed Contracts**

Use these testing approaches to validate your deployed contracts:

### Option 1: Development Testing (Local Hardhat Network)

For testing contracts before production deployment:

#### Registry Testing

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

#### OMATrust Resolver Testing

The OMATrust resolver system includes comprehensive test suites:

##### 🚀 Automated Test Runner (Recommended)

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

##### Manual Test Execution

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

### Option 2: Testnet/Mainnet Testing

For testing contracts already deployed to testnet or mainnet:

```bash
# Test deployed contracts using Hardhat tasks
npx hardhat get-apps --registry <DEPLOYED_ADDRESS> --network celoAlfajores
npx hardhat get-metadata-json --did "did:oma3:test" --registry <DEPLOYED_ADDRESS> --network celoAlfajores
```

See `test/README.md` for detailed testing guide and `test/TESTING_SUMMARY.md` for current status.

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

# Check app traits
npx hardhat has-traits --did "did:example:123" --traits "gaming,web3" --major 1 --mode "any" --registry <CONTRACT_ADDRESS> --network celoAlfajores
```

---

## **Migration from V0**

### Major Changes from V0

The current version represents a complete architectural redesign from the original v0 implementation:

#### 1. ERC721 Integration
- **V0**: Custom token system with simple ID assignment
- **Current**: Full ERC721 compatibility with marketplace integration

#### 2. DID-Based Versioning
- **V0**: Single version per DID, simple updates
- **Current**: Semantic versioning with (DID, major) uniqueness, multiple major versions as separate NFTs

#### 3. Data Structure
- **V0**: Simple flat fields (name, version, URLs)
- **Current**: Complex structured data with version history, interface bitmaps, keyword hashes

#### 4. Query Optimization
- **V0**: Linear searches, limited pagination
- **Current**: Optimized storage with active app indexing, efficient pagination, keyword filtering

#### 5. Interface System
- **V0**: Separate URL fields for different interface types
- **Current**: Bitmap-based interface system (human/API/MCP) with extensibility

#### 6. Versioning Constraints
- **V0**: No version validation or semantic constraints
- **Current**: Strict semver rules with controlled upgrade paths

#### 7. Storage Efficiency
- **V0**: Unoptimized storage layout
- **Current**: Gas-optimized packed structs and efficient mappings

#### 8. Event System
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
