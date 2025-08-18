# Hardhat Tasks Reference

This directory contains comprehensive Hardhat tasks for interacting with the OMA3 Application Registry contracts.

## 📁 Task Organization

### **Registry/** - Main Registry Functions
Core functionality for the `OMA3AppRegistry` contract:

```bash
# Basic app operations
npx hardhat get-app --did "did:example:app1" --major 1
npx hardhat get-apps --startfrom 0
npx hardhat get-apps-by-minter --minter 0x123...
npx hardhat total-supply

# App management
npx hardhat update-app-controlled --did "did:example:app1" --interfaces 5 --dataurl "https://example.com"
npx hardhat update-status --did "did:example:app1" --status "deprecated"

# Search and filtering
npx hardhat get-apps-by-status --status "active" --startfrom 0
npx hardhat has-keywords --did "did:example:app1" --keywords "gaming,web3" --mode "any"

# Utility functions  
npx hardhat get-did-hash --did "did:example:app1"
npx hardhat token-uri --tokenid 1
```

### **Metadata/** - Metadata Contract Functions
On-chain metadata storage and management:

```bash
# Set metadata for existing app
npx hardhat setmetadatajson --did "did:example:app1" --jsonfile "metadata.json"

# Register new app with metadata
npx hardhat registerapp --did "did:example:newapp" --interfaces 1 --jsonfile "metadata.json"

# Get stored metadata
npx hardhat getmetadatajson --did "did:example:app1"
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

### **Legacy/** - Legacy Contract Support
Tasks for the `OMA3AppRegistryLegacy` contract:

```bash
npx hardhat get-app-legacy --did "did:example:app1"
npx hardhat get-apps-legacy --startfrom 1
npx hardhat get-apps-by-minter-legacy --minter 0x123...
```

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
| **Registry** | 10 tasks | Core app registry operations |
| **Metadata** | 3 tasks | On-chain metadata management |
| **Inherited** | 7 tasks | Standard ERC721/Ownable functions |
| **Legacy** | 3 tasks | Legacy contract compatibility |
| **Total** | **23 tasks** | Complete contract coverage |

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
