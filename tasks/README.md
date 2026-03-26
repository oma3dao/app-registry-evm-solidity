# Hardhat Tasks Reference

This directory contains comprehensive Hardhat tasks for interacting with the OMA3 Application Registry contracts.

## 📁 Task Organization

Tasks are organized by contract domain. Use:
- admin/ for owner-only and cross-cutting policy/ownership changes
- registry/, resolver/, metadata/ for contract-specific ops used by most integrators

Signer policy:
- admin/ and deploy/: Deployer key (no CLI option; uses configured deployment signer)
- resolver/: Issuer key (see resolver:attest-dataurl section)
- registry/:
  - Read-only tasks: no signer needed
  - Write tasks (mint, set-metadata-json, update-status, update-app-controlled): require `--signerFileName` pointing to `~/.ssh/<file>`

### **Registry/** - Main Registry Functions
Core functionality for the `OMA3AppRegistry` contract:

```bash
# Basic app operations
npx hardhat get-app --did "did:example:app1" --major 1
npx hardhat get-apps --startfrom 0
npx hardhat get-apps-by-owner --owner 0x123...
npx hardhat total-supply

# App management
npx hardhat update-app-controlled --did "did:example:app1" --interfaces 5 --dataurl "https://example.com"
npx hardhat update-status --did "did:example:app1" --status "deprecated"
npx hardhat set-metadata-json --did "did:example:app1" --major 1 --minor 0 --patch 1 --jsonfile "metadata.json"

# Search and filtering
npx hardhat get-apps-by-status --status "active" --startfrom 0
npx hardhat has-traits --did "did:example:app1" --traits "gaming,web3" --mode "any"

# Metadata operations
npx hardhat metadata-get-json --did "did:example:app1"

# Utility functions  
npx hardhat get-did-hash --did "did:example:app1"
npx hardhat token-uri --tokenid 1
```

Signer options for registry write tasks:
- Pass your user key via SSH file: `--signerFileName <file>` reads from `~/.ssh/<file>` (hex private key inside)

Examples:
```bash
# Mint (write)
npx hardhat mint \
  --did "did:example:app1" \
  --interfaces 5 \
  --dataurl "https://example.com/app.json" \
  --signerFileName local-user-key

# Set metadata JSON (write)
npx hardhat set-metadata-json \
  --did "did:example:app1" \
  --jsonfile "metadata.json" \
  --signerFileName local-user-key

# Update status (write)
npx hardhat update-status \
  --did "did:example:app1" \
  --status deprecated \
  --signerFileName local-user-key

# Update app controlled fields (write)
npx hardhat update-app-controlled \
  --did "did:example:app1" \
  --interfaces 5 \
  --dataurl "https://example.com/app.json" \
  --signerFileName local-user-key
```

### **Metadata/** - Metadata Contract Functions

### **Resolver/** - Resolver & Attestations
Resolver utilities for DID ownership and data URL attestations:

```bash
# View attestations (ownership + data hash)
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --did did:web:example.com \
  --type both

# Only ownership attestations
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --did did:web:example.com \
  --type owner

# Only data hash attestations (optionally filter by dataHash)
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --did did:web:example.com \
  --type datahash \
  --datahash 0xHASH...

# View by issuer only
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --issuer 0xISSUER...
```

Parameters for `resolver-view-attestations`:
- **--did**: DID string (optional; show attestations for a DID)
- **--issuer**: Issuer address (optional; filter or list by issuer)
- **--resolver**: Resolver address (optional override; otherwise resolved from network)
- **--type**: owner | datahash | both (default: both)
- **--datahash**: 0x + 64-hex to filter specific data hash attestations

Registry task signer options:
- For all `registry/` tasks you can specify the signer via one of:
  - `--signerFileName <file>` to load from `~/.ssh/<file>`
  - `USER_PRIVATE_KEY` environment variable

```bash
# Attest a dataUrl hash (precomputed off-chain with JCS + keccak256)
npx hardhat resolver:attest-dataurl \
  --network omachainTestnet \
  --did did:web:example.com \
  --datahash 0xHASH... \
  --expires 0

# Flat alias also available
npx hardhat resolver-attest-dataurl \
  --network omachainTestnet \
  --did did:web:example.com \
  --datahash 0xHASH... \
  --expires 0

Parameters for `resolver:attest-dataurl` (and alias `resolver-attest-dataurl`):
- **--did**: DID string (e.g., did:web:example.com)
- **--datahash**: bytes32 hash (0x + 64 hex) of JCS-normalized JSON
- **--expires**: unix seconds (0 = no expiry)

Note: The resolver contract address is resolved automatically from `NETWORK_CONTRACTS` for the selected `--network`.

On-chain metadata storage and management:

```bash
# Set metadata for existing app
npx hardhat setmetadatajson --did "did:example:app1" --jsonfile "metadata.json"

# Register new app with metadata
npx hardhat registerapp --did "did:example:newapp" --interfaces 1 --jsonfile "metadata.json"

# Get stored metadata
npx hardhat metadata-get-json --did "did:example:app1"
```

### **Inherited/** - ERC721 & Ownable Functions
Standard contract functions from OpenZeppelin:

```bash
# ERC721 functions
npx hardhat owner-of --tokenid 1
npx hardhat balance-of --address 0x123...
npx hardhat approve --to 0x456... --tokenid 1
npx hardhat transfer-from --from 0x123... --to 0x456... --tokenid 1
npx hardhat get-approved --tokenid 1

# Ownable functions
npx hardhat get-owner
npx hardhat transfer-ownership --newowner 0x123...
npx hardhat renounce-ownership  # ⚠️ DANGEROUS!
```

---

## 🚀 Deployment Workflows

See **[tasks/deploy/README.md](deploy/README.md)** for complete step-by-step deployment checklists:
- OMAchain deployment (full system + EAS + TimelockController + server wallet setup)
- External chain deployment (fee resolver + schemas only)

---

## 📋 Task Reference

### **EAS/** - Ethereum Attestation Service Tasks

Interact with EAS contracts for creating and managing attestations:

#### **Register a Schema**
```bash
# Register a simple schema
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "string name,uint8 score"

# Register with custom resolver
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "string name,uint8 score" \
  --resolver 0xYOUR_RESOLVER_ADDRESS \
  --revocable true
```

#### **Get Schema Details**
```bash
npx hardhat eas-get-schema \
  --network omachainTestnet \
  --uid 0xSCHEMA_UID
```

#### **Create an Attestation**
```bash
# Simple attestation (auto-encode data)
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xSCHEMA_UID \
  --recipient 0xRECIPIENT_ADDRESS \
  --types "string,uint8" \
  --values "Alice,95"

# With expiration
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xSCHEMA_UID \
  --recipient 0xRECIPIENT_ADDRESS \
  --types "string,uint8,address" \
  --values "Bob,100,0x123..." \
  --expiration 1735689600

# Or use pre-encoded data
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xSCHEMA_UID \
  --recipient 0xRECIPIENT_ADDRESS \
  --data 0xENCODED_DATA
```

#### **Encode Data (Helper)**
```bash
# Encode data separately if needed
npx hardhat eas-encode-data \
  --types "string,uint8,address" \
  --values "Alice,95,0x123..."
```

#### **Get Attestation Details**
```bash
npx hardhat eas-get-attestation \
  --network omachainTestnet \
  --uid 0xATTESTATION_UID
```

#### **Revoke an Attestation**
```bash
npx hardhat eas-revoke \
  --network omachainTestnet \
  --schema 0xSCHEMA_UID \
  --uid 0xATTESTATION_UID
```

**EAS Task Parameters:**
- `--schema`: Schema definition or UID (bytes32)
- `--uid`: Schema or attestation UID (bytes32)
- `--recipient`: Address receiving the attestation
- `--data`: ABI-encoded attestation data (optional if using --types/--values)
- `--types`: Comma-separated types for auto-encoding (e.g., "string,uint8")
- `--values`: Comma-separated values for auto-encoding (e.g., "Alice,95")
- `--resolver`: Custom resolver address (optional)
- `--revocable`: Whether attestations can be revoked (default: true)
- `--expiration`: Unix timestamp for expiration (0 = never)
- `--refuid`: Referenced attestation UID (optional)

**Complete Example Workflow:**
See `tasks/samples/eas-workflow-example.md` for a full end-to-end example of creating an app rating system with EAS.

---

### **Admin Commands Reference**

Quick reference for common admin operations:

```bash
# Add/remove issuers
npx hardhat resolver-add-issuer --network <network> --issuer <address>
npx hardhat resolver-remove-issuer --network <network> --issuer <address>

# Adjust resolver settings
npx hardhat resolver-set-maturation --network <network> --duration <seconds>
npx hardhat resolver-set-max-ttl --network <network> --duration <seconds>

# Configure registry resolvers (for individual contract deployments)
npx hardhat registry-set-ownership-resolver --network <network> --resolver <address>
npx hardhat registry-set-dataurl-resolver --network <network> --resolver <address>
npx hardhat registry-set-registration-resolver --network <network> --resolver <address>

# View attestations
npx hardhat resolver-view-attestations --network <network> --did <did-string>

# Transfer contract ownership (DANGEROUS!)
npx hardhat registry-transfer-owner --network <network> --newowner <address>
npx hardhat metadata-transfer-owner --network <network> --newowner <address>
npx hardhat resolver-transfer-owner --network <network> --newowner <address>
```

---

### **Shared/** - Common Utilities
Helper functions used across all tasks:
- Environment variable management
- Contract address resolution
- Display utilities

## 🚀 Quick Start Examples

### Register a New App with Metadata
```bash
npx hardhat registerapp \
  --did "did:example:myapp" \
  --interfaces 5 \
  --jsonfile "myapp-metadata.json"
```

### Update App Information
```bash
npx hardhat update-app-controlled \
  --did "did:example:myapp" \
  --interfaces 7 \
  --dataurl "https://myapp.com/api" \
  --keywords "gaming,web3,defi"
```

### Find All Gaming Apps
```bash
npx hardhat has-keywords \
  --did "did:example:myapp" \
  --keywords "gaming" \
  --mode "any"
```

### Transfer App Ownership
```bash
npx hardhat transfer-from \
  --from 0x123... \
  --to 0x456... \
  --tokenid 1
```

## 📊 Task Categories Summary

| Category     | Tasks    | Purpose                                    |
|--------------|----------|--------------------------------------------|
| **Deploy**   | 6 tasks  | Contract deployment (system + individual)  |
| **Admin**    | 11 tasks | Contract configuration and permissions     |
| **Registry** | 10 tasks | Core app registry operations               |
| **Metadata** | 3 tasks  | On-chain metadata management               |
| **Inherited**| 7 tasks  | Standard ERC721/Ownable functions          |
| **Legacy**   | 3 tasks  | Legacy contract compatibility              |
| **Total**    | **40 tasks** | Complete contract lifecycle coverage   |

## 🎯 Common Workflows

### 1. App Registration Flow
```bash
# 1. Register new app
npx hardhat registerapp --did "did:example:newapp" --interfaces 1

# 2. Add metadata
npx hardhat setmetadatajson --did "did:example:newapp" --jsonfile "metadata.json"

# 3. Verify registration
npx hardhat get-app --did "did:example:newapp"
```

### 2. App Management Flow  
```bash
# 1. Update app details
npx hardhat update-app-controlled --did "did:example:app" --interfaces 5

# 2. Change status
npx hardhat update-status --did "did:example:app" --status "deprecated"

# 3. Transfer ownership
npx hardhat transfer-from --from 0x123... --to 0x456... --tokenid 1
```

### 3. Discovery Flow
```bash
# 1. Browse all apps
npx hardhat get-apps

# 2. Filter by status
npx hardhat get-apps-by-status --status "active"

# 3. Search by keywords
npx hardhat has-keywords --did "did:example:app" --keywords "gaming,web3"
```

All tasks include comprehensive error handling, ownership verification, and detailed output for debugging and operational use.
