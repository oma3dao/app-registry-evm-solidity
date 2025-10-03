# **OMATrust Application Registry - EVM/Solidity**

A production-ready ERC721-based registry with semantic versioning, efficient querying, and comprehensive metadata management.

This repository implements the Application Registry actor described in the Inter World Portaling System specification for identity.

## **License and Participation**

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

**Licensing Notice**  
This initial version (v1) is released under MIT to maximize transparency and adoption.  

OMA3 may license future versions of this reference implementation under different terms (for example, the Business Source License, BSL) if forks or incompatible implementations threaten to fragment the ecosystem or undermine the sustainability of OMA3.  

OMA3 standards (such as specifications and schemas) will always remain open and are governed by [OMA3's IPR Policy](https://www.oma3.org/intellectual-property-rights-policy).

## **OMATrust Architecture Overview**

This overview is for convenience. The source of truth for OMATrust architecture is the [official specifiction](https://github.com/oma3dao/omatrust-docs/blob/main/specification/omatrust-specification.md). 

The OMA3 system consists of two main smart contracts working together:

### OMA3AppRegistry - Application Registration & NFT Management
An ERC721 contract that holds valuable metadata on an application where each app token represents a unique (DID, major version) combination. This design enables:

- **Discoverbility**: Makes OMATrust the decentralized app store for the open and machine-drive internet.
- **Semantic Versioning**: Full semver support (major.minor.patch) with controlled upgrade paths
- **ERC721 Compatibility**: Standard NFT interfaces for marketplace integration and ownership management
- **Efficient Queries**: Optimized storage layout for fast lookups by status, owner, and keywords

### OMA3ResolverWithStore - OMATrust DID Ownership & Data Integrity System
A resolver contract that provides the foundation for decentralized identity and trust management:

- **DID Ownership Resolution**: Authoritative determination of who controls a DID
- **Data Hash Attestation**: Cryptographic proof of data integrity for app manifests
- **Issuer Authorization**: Allowlist of trusted attestation providers
- **EIP-712 Delegated Operations**: Secure off-chain signature-based attestations
- **Maturation Windows**: 48-hour maturation period for ownership changes to prevent attacks
- **Future-Proof Interfaces**: Stable interfaces designed for long-term compatibility with future hub systems

There is also an optional **OMA3AppMetadata** contract that gives app developers the option to store metadata onchain that is typically stored offchain.  

### Attestations

OMATrust leverages existing cross-chain attestation services to provide the trust layer, which is the raison d'etre for OMATrust.

## **🔒 App Registration Model: Attestation-First vs Permissionless**

To maintain trust in the ecosystem, developers must obtain DID ownership attestations before registering applications in the registry. This ensures only legitimate DID controllers can mint applications for their identities.  OMA3 offers an automated system for obtaining these attestations, but developers SHOULD attain manual third party attestations (e.g.- from their auditor) to increase trust in their apps (the whole purpose of OMATrust).

### Registration Workflow
1. Developer obtains DID ownership and dataURL attestations from authorized Issuer(s).  An Issuer is a third party that issues attestations (or in the DID world, "Verifiable Credentials").
2. Resolver validates DID ownership before application minting.
3. Registry verifies dataHash, creates a hash of the DID, and mints ERC721 token for the (didHash, major version) combination.
4. Ongoing dataUrl integrity is validated through resolver's attestation system.

### DID Ownership Details
- **Decentralized Identifiers (DIDs)**: Globally unique identifiers that are the primary identity mechanism of OMATrust.  DIDs are standardized by the [W3C](https://www.w3.org/TR/did-1.1/)
- **Ownership Attestations**: Cryptographic proofs linking DIDs to controlling wallet addresses (e.g.- the wallet minting the application)
- **Authorized Issuers**: Allowlisted entities that can create valid ownership attestations
- **Maturation Period**: 48-hour delay for ownership changes to prevent malicious takeovers

## **Highlighted Concepts**

Again, see the [OMATrust Specification](https://github.com/oma3dao/omatrust-docs/blob/main/specification/omatrust-specification.md) for "the truth".

### Registry Functionality
- **Interfaces**: Supports 1. applications used by humans, 2. APIs used by machines (incuding MCP Servers and A2A agents), and 3. smart contracts.  An application can support more than one interface
- **Status Management**: Applications can be active, deprecated, or replaced
- **Traits Tagging**: Hash-based keyword system for discoverability.  Certain traits reveal important information on an application, such as the API protocol supported (MCP, A2A, GraphQL, etc.)
- **Off-chain Data**: dataUrl + dataHash for integrity verification by OMATrust clients
- **Optional Metadata Storage**: dataUrl JSON objects can be stored onchain

### Security Features
- **DID Ownership Validation**: Ensures only legitimate DID controllers can register applications
- **Data Integrity Verification**: Cryptographic proof of application manifest authenticity
- **Authorized Issuer Network**: Decentralized trust through multiple authorized attestation providers
- **Attack Prevention**: Maturation windows and replay protection prevent malicious ownership changes
- **EIP-712 Compliance**: Industry-standard signature verification for off-chain operations

### Versioning Control

- **DID (Decentralized Identifier)**: Immutable unique identifier for an application (e.g.- web domain or CAIP-10 address)
- **Major Versions**: New major versions require minting a new NFT (new tokenID)
- **Minor Versions**: New minor version increments are required for certain revisions of application metadata
- **Patch Versions**: All changes must at least increment the patch version

These security and versioning features bring centralized app store and ecommerce trust to the open and machine-driven internet.

### Permanent Interfaces for Future Compatibility

The resolver implements stable interfaces designed for long-term compatibility:

- **`IOMA3Resolver`**: Core resolution functions (`currentOwner`, `isDataHashValid`)
- **`IOMA3DidOwnershipAttestationStore`**: DID ownership management with EIP-712 support
- **`IOMA3DataUrlAttestationStore`**: Data integrity attestation management

These interfaces ensure smooth migration to future hub systems (see below) that may store both on-chain and off-chain attestations.

## Smart Contract API

### Write Functions

#### Minting Applications

```solidity
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
) external nonReentrant returns (uint256)
```

1. **DID Ownership**: Caller must have valid ownership attestation for the DID via `OMA3ResolverWithStore.currentOwner()`
2. **Data Integrity**: The `dataHash` must be attested as valid via `OMA3ResolverWithStore.isDataHashValid()`  

Note: The `metadataJson` parameter is optional. If provided, the JSON will be stored on-chain.  If not, owner needs to host dataUrl.

#### Updating Applications

```solidity
function updateAppControlled(
    string memory didString,
    uint8 major,
    string memory newDataUrl,
    bytes32 newDataHash,
    uint8 newDataHashAlgorithm,
    uint16 newInterfaces,
    bytes32[] memory newTraitHashes,
    uint8 newMinor,
    uint8 newPatch
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

### Read Functions

#### Get Application Data

```solidity
function getApp(string memory didString, uint8 major) 
    external view returns (App memory)

function getDIDByTokenId(uint256 tokenId) 
    external view returns (string memory)

function latestMajor(bytes32 didHash) 
    external view returns (uint8)
```

#### Get Application Lists

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
function hasAnyTraits(string memory didString, uint8 major, bytes32[] memory keywords) 
    external view returns (bool)

function hasAllTraits(string memory didString, uint8 major, bytes32[] memory keywords) 
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

## Deployments

### Current Deployment

#### **OMA3AppRegistry** (ERC721 Application Registry)
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0x1a58589a9989C7E84128938Af06ede00593cFE31  // 0xE2d601F18166F6632f80d2Fa0Ab474B6d251D400
- **Legacy Contract Address**: 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83

- **Network**: OMAchain Testnet
- **Contract Address**: [TO BE DEPLOYED - See deployment instructions below]

#### **OMA3AppMetadata** (On-chain JSON Storage)
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0x24B0B17adb13DB2146995480e0114b2c93Df217f 
- **Legacy Contract Address**: 0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9

- **Network**: OMAchain Testnet
- **Contract Address**: [TO BE DEPLOYED - See deployment instructions below]

#### **OMA3ResolverWithStore** (OMATrust DID & Data Validation)
- **Network**: Celo Alfajores Testnet  
- **Contract Address**: [TO BE DEPLOYED - See deployment instructions below]

- **Network**: OMAchain Testnet
- **Contract Address**: [TO BE DEPLOYED - See deployment instructions below]
- **Purpose**: DID ownership resolution and data hash attestation validation

## Deployment

### Production Deployment

**⚠️ For production deployments to mainnet or public testnets**, use the secure Thirdweb deployment system with HSM-backed server wallets. See the [Thirdweb Deployment README](scripts/deploy/README.md) for complete instructions.

### Development Deployment

**For Development/Testing ONLY**

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

2. **Start local Hardhat node**:
   ```bash
   npx hardhat node
   ```

3. **Deploy complete system to localhost**:
   ```bash
   # Deploy complete system (Registry + Metadata + Resolver) with linking
   npm run deploy:system -- --network localhost
   ```

4. **Deploy to testnets for development**:
   ```bash
   # Deploy to OMAchain testnet
   npm run deploy:system -- --network omachainTestnet
   ```

5. **Verify contracts on explorer** (won't work on localhost):
   ```bash
   # Set API key 
   export OMACHAIN_API_KEY=your_api_key_here

   # Verify contracts using addresses from deployment output
   npx hardhat verify --network omachainTestnet <REGISTRY_ADDRESS>
   npx hardhat verify --network omachainTestnet <METADATA_ADDRESS>
   npx hardhat verify --network omachainTestnet <RESOLVER_ADDRESS>
   ```

### Testing Against Your Localhost Deployment

**Important**: By default, `npm test` runs tests against fresh contract deployments in Hardhat's built-in test network, not against your running localhost node.

To test against contracts deployed to your running localhost node:

```bash
# Terminal 1: Keep your node running
npx hardhat node

# Terminal 2: Deploy to localhost
npm run deploy:system -- --network localhost

# Terminal 2: Run tests against localhost
npx hardhat test --network localhost
```

This will test your specific deployed contracts with their actual addresses, rather than creating fresh deployments for each test.

### What Gets Deployed

The `deploy-system` script deploys and links three contracts:

1. **OMA3AppRegistry** - Main application registry contract
2. **OMA3AppMetadata** - On-chain metadata storage contract  
3. **OMA3ResolverWithStore** - DID ownership resolution and data validation contract

All contracts are automatically linked together with proper authorization settings.

### Configuring the Resolver

After deployment, you can configure the resolver's security parameters:

```bash
# Set maturation period (default: 172800 seconds = 48 hours)
# For development, you might want 0 seconds for immediate testing
npx hardhat configure-resolver \
  --resolver <RESOLVER_ADDRESS> \
  --maturation 0 \
  --network localhost

# Add authorized issuer (entity that can create DID ownership attestations)
npx hardhat configure-resolver \
  --resolver <RESOLVER_ADDRESS> \
  --issuer 0x1234567890123456789012345678901234567890 \
  --network localhost

# Set maximum TTL for attestations (default: 63072000 seconds = 2 years)
npx hardhat configure-resolver \
  --resolver <RESOLVER_ADDRESS> \
  --maxTTL 31536000 \
  --network localhost

# Remove an authorized issuer
npx hardhat configure-resolver \
  --resolver <RESOLVER_ADDRESS> \
  --removeIssuer 0x1234567890123456789012345678901234567890 \
  --network localhost
```

**Configuration Parameters:**
- **`maturation`** - Delay period before DID ownership changes take effect (prevents attacks)
- **`maxTTL`** - Maximum time-to-live for attestations before they expire
- **`issuer`** - Address authorized to create DID ownership and data hash attestations
- **`removeIssuer`** - Remove an address from the authorized issuers list

**Development Tip:** Set maturation to `0` for local testing to avoid waiting periods.

### Contract ABI

The contract ABIs are generated automatically when you compile the contracts and can be found at:

```
artifacts/contracts/
```

You can extract just the ABI portion for use in your frontend applications:

```bash
# Using jq (if installed)
jq .abi artifacts/contracts/OMA3AppRegistry.sol/OMA3AppRegistry.json > oma3app-registry-abi.json

# Or manually open the file and copy the "abi" array
```

## **Usage**

### 🌐 Frontend Applications (Recommended for Most Developers)

For 99% of developers, use the web applications instead of coding directly:

#### Application Registration
**🚀 [appregistry.oma3.org](https://appregistry.oma3.org)**
- **User-friendly interface** for registering and managing OMA3 applications
- **Visual workflow** for DID attestation and application minting
- **Guided process** ensures all OMATrust requirements are met
- **No coding required** - just fill out forms and connect your wallet

#### Reputation & Attestations 
**⭐ [reputation.oma3.org](https://reputation.oma3.org)**
- **Create attestations** for DID ownership and data integrity
- **Manage reputation** and extended attestations via EAS integration
- **Issuer interface** for authorized attestation providers
- **Community tools** for reviews, endorsements, and certifications

#### Why Use the Frontend?
- ✅ **No technical knowledge required** - intuitive web interface
- ✅ **Automatic validation** - ensures all requirements are met
- ✅ **Integrated workflow** - handles OMATrust attestations seamlessly  
- ✅ **Real-time feedback** - immediate error checking and guidance
- ✅ **Mobile friendly** - works on all devices
- ✅ **Community features** - discover and interact with other developers

### 💻 Programmatic Integration (Advanced Users)

For developers who need programmatic access to the smart contracts, refer to the code examples below and the [app-registry-evm-solidity GitHub repository](https://github.com/oma3dao/app-registry-evm-solidity) for complete implementation details.

#### JavaScript/Web3

Minting:

```javascript
// Get contracts
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
  traitHashes,                 // Keywords
  metadataContent             // Optional: store JSON on-chain
);

console.log("Application minted successfully:", tx.hash);
```

Updating:

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

Querying:

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

#### Command Line

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

### Submitting Ownership Attestations

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

### Trust Attestations- The Backbone of OMATrust

For attestations beyond core DID ownership and data integrity, the OMA3 ecosystem integrates with proven attestation services such as [EAS (Ethereum Attestation Service)](https://attest.sh/) and [BAS (Base Attestation Service)](https://github.com/base-org/bas) deployed on various chains, including OMAChain.

#### Examples of Extended Attestations:
- **Security Audits**: Third-party security assessment results
- **Compliance Certifications**: Regulatory or industry standard compliance
- **Integration Approvals**: Platform-specific authorization attestations
- **User Reviews**: Community feedback and ratings

#### To interface with OMAChain attestations:

- **Frontend**: Use **[reputation.oma3.org](https://reputation.oma3.org)** for user-friendly attestation management
- **Technical Details**: See [rep-attestation-tools-evm-solidity](https://github.com/oma3dao/rep-attestation-tools-evm-solidity) and [rep-attestation-frontend](https://github.com/oma3dao/rep-attestation-frontend) repositories

#### **Index Function: DID → Recipient Mapping**

EAS and BAS are not designed for OMATrust's DID-based identity system.  To utilize DIDs in these systems, the OMATrust specification requires usage of a function that maps DIDs to Ethereum formatted addresses (support for future virtual machines forthcoming):

```solidity
// Helper function for EAS integration
function didToRecipient(string memory didString) public pure returns (bytes32) {
    return keccak256(abi.encodePacked("did:", didString));
}
```

The resulting "address" can be used as the recipient in EAS-based attestation services.

## **Future Resolver -> Hub Migration Path**

The OMATrust resolver system is designed for seamless migration to future hub systems:

### Stable Interface Guarantee
The resolver implements permanent interfaces that will be maintained across all future versions:
- `IOMA3Resolver` - Core resolution functions
- `IOMA3DidOwnershipAttestationStore` - Ownership management  
- `IOMA3DataUrlAttestationStore` - Data integrity validation

### Hub System Evolution
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

### **Future Hub Capabilities**
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
