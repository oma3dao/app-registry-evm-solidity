# EAS Contracts v1.4.0

These contracts are copied from the official Ethereum Attestation Service:
https://github.com/ethereum-attestation-service/eas-contracts

**Version:** v1.4.0  
**Commit:** [Check eas-contracts repo]  
**Date Copied:** 2024-10-22

## Contracts to Deploy

### Core (Required for OMAChain only)
- **SchemaRegistry.sol** - Registry for attestation schemas
- **EAS.sol** - Main attestation contract

### Optional
- **Indexer.sol** - On-chain indexing for efficient queries

## Custom Resolvers

Custom resolvers are located in `resolver/custom/`.

### OMATrustFeeResolver

**Purpose:** Collect fees for attestations on external chains (Ethereum, Base, Arbitrum, etc.)

**Location:** `resolver/custom/OMATrustFeeResolver.sol`

**Features:**
- Charges exact fixed fee per attestation (in wei)
- Immediately forwards fees to treasury (Gnosis Safe compatible)
- No admin functions - fee and recipient are immutable
- No custody - contract never holds funds

**Deployment:**
```bash
npx hardhat deploy-fee-resolver \
  --eas 0x4200000000000000000000000000000000000021 \
  --fee 0.001 \
  --treasury 0xYourGnosisSafeAddress \
  --network base
```

**Usage with schemas:**
```bash
# In rep-attestation-tools-evm-solidity
npx hardhat deploy-eas-schema \
  --file generated/Endorsement.eas.json \
  --resolver 0xDeployedFeeResolverAddress \
  --network base
```

**Testing:**
```bash
# Run unit tests
npx hardhat test test/OMATrustFeeResolver.test.ts

# Run sanity check on deployed resolver
npx hardhat fee-resolver-sanity --resolver 0xDeployedAddress --network base
```

## Supporting Files (Not Deployed)

These are interfaces and base classes needed for compilation:
- Common.sol - Shared types and constants
- IEAS.sol - EAS interface
- ISchemaRegistry.sol - Schema registry interface
- ISemver.sol - Semver interface
- Semver.sol - Version tracking base class
- eip1271/EIP1271Verifier.sol - Signature verification base class
- resolver/ISchemaResolver.sol - Resolver interface
- resolver/SchemaResolver.sol - Resolver base class

## Deployment Strategy

### OMAChain (deploy full EAS system)
```bash
npx hardhat deploy-eas-system --network omachainTestnet
```
- Deploys SchemaRegistry + EAS
- No resolver needed (server-side validation handles spam)

### External Chains (use existing EAS)
```bash
# 1. Deploy fee resolver
npx hardhat deploy-fee-resolver --eas <EAS_ADDRESS> --fee 0.001 --treasury <SAFE_ADDRESS> --network base

# 2. Deploy schemas with resolver (in rep-attestation-tools repo)
npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --resolver <RESOLVER_ADDRESS> --network base
```

## Known EAS Addresses

### Mainnets

| Chain        | Chain ID | EAS                                        | SchemaRegistry                             |
|--------------|----------|--------------------------------------------|--------------------------------------------|
| Ethereum     | 1        | 0xA1207F3BBa224E2c9c3c6D5e6f0C5E1e6cA82b8C | 0xA7b39296258348C78294F95B872b282326A97BDF |
| Optimism     | 10       | 0x4200000000000000000000000000000000000021 | 0x4200000000000000000000000000000000000020 |
| Arbitrum One | 42161    | 0xA1207F3BBa224E2c9c3c6D5e6f0C5E1e6cA82b8C | 0xA7b39296258348C78294F95B872b282326A97BDF |
| Base         | 8453     | 0xA1207F3BBa224E2c9c3c6D5e6f0C5E1e6cA82b8C | 0xA7b39296258348C78294F95B872b282326A97BDF |
| Polygon      | 137      | 0xA1207F3BBa224E2c9c3c6D5e6f0C5E1e6cA82b8C | 0xA7b39296258348C78294F95B872b282326A97BDF |

### Testnets

| Chain           | Chain ID | EAS                                        | SchemaRegistry                             |
|-----------------|----------|--------------------------------------------|--------------------------------------------|
| Sepolia         | 11155111 | 0xC2679fBD37d54388Ce493F1DB75320D236e1815e | 0x0a7E2Ff54e76B8e6659c1CcfA2dDd2E4D58C61C4 |
| Optimism Sepolia| 11155420 | 0x4200000000000000000000000000000000000021 | 0x4200000000000000000000000000000000000020 |
| Arbitrum Sepolia| 421614   | 0xC2679fBD37d54388Ce493F1DB75320D236e1815e | 0x0a7E2Ff54e76B8e6659c1CcfA2dDd2E4D58C61C4 |
| Base Sepolia    | 84532    | 0xC2679fBD37d54388Ce493F1DB75320D236e1815e | 0x0a7E2Ff54e76B8e6659c1CcfA2dDd2E4D58C61C4 |

**Note:** Mainnet/Base/Arbitrum/Polygon share the same canonical EAS addresses. Optimism uses predeploy-style addresses (0x4200...).

See https://docs.attest.org/docs/quick--start/contracts for the authoritative list.

## Modifications

**Do not modify standard EAS files.** They are copied from the official EAS repository.

For custom functionality, add new resolvers in `resolver/custom/`.

## Updating

To update to a new EAS version:
1. Check the official repo for new releases
2. Copy new contracts: `cp -r ../../eas-contracts/contracts/* ./`
3. Clean up: Remove tests, examples
4. Preserve custom resolvers in `resolver/custom/`
5. Test compilation: `npx hardhat compile`
6. Update this README with new version info
