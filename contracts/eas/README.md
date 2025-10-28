# EAS Contracts v1.4.0

These contracts are copied from the official Ethereum Attestation Service:
https://github.com/ethereum-attestation-service/eas-contracts

**Version:** v1.4.0  
**Commit:** [Check eas-contracts repo]  
**Date Copied:** 2024-10-22

## Contracts to Deploy

### Core (Required)
- **SchemaRegistry.sol** - Registry for attestation schemas
- **EAS.sol** - Main attestation contract

### Optional
- **Indexer.sol** - On-chain indexing for efficient queries

### Custom Resolvers (OMA3)
- **resolver/RateLimitResolver.sol** - Rate limiting for spam prevention
- **resolver/GaslessSchemaResolver.sol** - Comprehensive gasless schema protection

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

## Deployment

See `tasks/deploy/eas/` for Hardhat deployment tasks.

## Modifications

**Do not modify these files.** They are copied from the official EAS repository.

For upstream EAS contributions, use the separate `eas-contracts/` repository.

For OMA-specific customizations, add new resolvers in the `resolver/` folder.

## Updating

To update to a new EAS version:
1. Check the official repo for new releases
2. Copy new contracts: `cp -r ../../eas-contracts/contracts/* ./`
3. Clean up: Remove tests, examples, eip712 (if not needed)
4. Re-add custom resolvers
5. Test compilation: `npx hardhat compile`
6. Update this README with new version info
