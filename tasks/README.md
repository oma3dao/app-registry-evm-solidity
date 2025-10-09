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

### **USE CASE 1: Initial System Deployment** (First time setup)

Use this when deploying to a new network for the first time.

#### **Step 1: Deploy the system**
```bash
npx hardhat deploy-system --network omachainTestnet --confirmations 1
```

This will:
- Deploy Registry, Metadata, and Resolver contracts
- Automatically link them together
- Output all contract addresses

**Save these addresses!** You'll see output like:
```
Registry: 0x1234...
Metadata: 0x5678...
Resolver: 0x9abc...
```

#### **Step 2: Update configuration files**
```bash
# Update these 3 files with the new addresses:
# 1. contract-addresses.txt
# 2. hardhat.config.ts → NETWORK_CONTRACTS.omachainTestnet
# 3. app-registry-frontend/src/config/chains.ts
```

#### **Step 3: Add authorized issuers (REQUIRED)**
```bash
npx hardhat resolver-add-issuer \
  --network omachainTestnet \
  --issuer 0x7D5beD223Bc343F114Aa28961Cc447dbbc9c2330
```

**Without this step, minting will fail!** The resolver needs at least one authorized issuer.

#### **Step 4: (Optional) Adjust resolver settings**
```bash
# Maturation period (default: 48 hours = 172800 seconds)
npx hardhat resolver-set-maturation --network omachainTestnet --duration 172800

# Max TTL (default: 2 years = 63072000 seconds)
npx hardhat resolver-set-max-ttl --network omachainTestnet --duration 63072000
```

#### **Step 5: Verify contracts on block explorer (optional)**

**What this does:** Uploads your Solidity source code to the block explorer so users can read it.

**When to do this:**
- ✅ Production deployments for transparency
- ❌ Local testing (won't work on localhost)
- ⚠️ May not work on OMAchain testnet yet (check if explorer supports it)

```bash
# Only needed if the block explorer requires an API key
# Check https://explorer.testnet.chain.oma3.org/ documentation
export OMACHAIN_API_KEY=your_api_key_here

# Verify each contract (will fail gracefully if not supported)
npx hardhat verify --network omachainTestnet <REGISTRY_ADDRESS>
npx hardhat verify --network omachainTestnet <METADATA_ADDRESS>
npx hardhat verify --network omachainTestnet <RESOLVER_ADDRESS>
```

**If verification fails:** Don't worry! Your contracts still work. Verification is only for transparency.

#### **Step 6: Test the deployment**
```bash
# Should return empty array for new deployment
npx hardhat get-apps --network omachainTestnet

# Try minting your first app from the frontend
# If it works, your deployment is successful!
```

**✅ System deployment complete!**

---

### **USE CASE 2: Upgrade Single Contract** (Fix bugs without losing data)

Use this when you need to fix a bug in one contract without redeploying everything.

**Example: Upgrading the Resolver (like fixing the issuer array bug)**

#### **Step 1: Deploy the new contract**
```bash
npx hardhat deploy-resolver --network omachainTestnet --confirmations 1
```

**Save the new address!** You'll see:
```
Resolver: 0xNEW_ADDRESS_HERE
```

#### **Step 2: Update configuration files**
```bash
# Update the Resolver address in these 3 files:
# 1. contract-addresses.txt
# 2. hardhat.config.ts → NETWORK_CONTRACTS.omachainTestnet.resolver
# 3. app-registry-frontend/src/config/chains.ts → omachainTestnet.contracts.resolver
```

#### **Step 3: Link the new Resolver to Registry**
```bash
# Point Registry to new Resolver (2 transactions)
npx hardhat registry-set-ownership-resolver \
  --network omachainTestnet \
  --resolver 0xNEW_RESOLVER_ADDRESS

npx hardhat registry-set-dataurl-resolver \
  --network omachainTestnet \
  --resolver 0xNEW_RESOLVER_ADDRESS
```

#### **Step 4: Add authorized issuers to new Resolver**
```bash
# The new Resolver starts with NO issuers - you must re-add them
npx hardhat resolver-add-issuer \
  --network omachainTestnet \
  --issuer 0x7D5beD223Bc343F114Aa28961Cc447dbbc9c2330
```

#### **Step 5: Test the upgrade**
```bash
# Verify existing apps are still there
npx hardhat get-apps --network omachainTestnet

# Try minting a new app from the frontend
# If it works, your upgrade is successful!
```

**✅ Resolver upgrade complete! Your existing apps and metadata are preserved.**

---

### **Other Individual Contract Upgrades**

#### **Upgrading Registry:**
```bash
# 1. Deploy
npx hardhat deploy-registry --network omachainTestnet --confirmations 1

# 2. Update configs (3 files)

# 3. Link to existing Metadata and Resolver
npx hardhat registry-set-metadata-contract --network omachainTestnet --metadata <existing-metadata>
npx hardhat registry-set-ownership-resolver --network omachainTestnet --resolver <existing-resolver>
npx hardhat registry-set-dataurl-resolver --network omachainTestnet --resolver <existing-resolver>

# 4. Update Metadata to trust new Registry
npx hardhat metadata-authorize-registry --network omachainTestnet --registry <new-registry>

# ⚠️ WARNING: All registered apps in the OLD Registry are lost!
```

#### **Upgrading Metadata:**
```bash
# 1. Deploy
npx hardhat deploy-metadata --network omachainTestnet --confirmations 1

# 2. Update configs (3 files)

# 3. Link to existing Registry
npx hardhat metadata-authorize-registry --network omachainTestnet --registry <existing-registry>

# 4. Update Registry to use new Metadata
npx hardhat registry-set-metadata-contract --network omachainTestnet --metadata <new-metadata>

# ⚠️ WARNING: All metadata in the OLD Metadata contract is lost!
```

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

| Category | Tasks | Purpose |
|----------|-------|---------|
| **Deploy** | 4 tasks | Contract deployment (system + individual) |
| **Admin** | 11 tasks | Contract configuration and permissions |
| **Registry** | 10 tasks | Core app registry operations |
| **Metadata** | 3 tasks | On-chain metadata management |
| **Inherited** | 7 tasks | Standard ERC721/Ownable functions |
| **Legacy** | 3 tasks | Legacy contract compatibility |
| **Total** | **38 tasks** | Complete contract lifecycle coverage |

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
