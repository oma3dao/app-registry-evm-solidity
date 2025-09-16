# OMA3ResolverWithStore Testing

This directory contains comprehensive test suites for the OMATrust resolver system, including the `OMA3ResolverWithStore` contract and its interfaces.

## Test Files

### Core Tests
- **`OMA3ResolverWithStore.ts`** - Main unit tests covering all basic functionality
- **`OMA3ResolverIntegration.ts`** - Complex integration scenarios and edge cases

### Helpers
- **`helpers/testUtils.ts`** - Utility functions and test scenario builders

## Test Coverage

### ✅ Deployment and Configuration
- Contract deployment with correct initial values
- Owner permissions and access control
- Policy configuration (maturation, max TTL)

### ✅ Issuer Authorization Management  
- Adding and removing authorized issuers
- Access control validation
- Event emission verification

### ✅ Ownership Attestations
- Direct upsert and revoke operations
- Delegated operations via EIP-712 signatures
- Nonce management and replay protection
- TTL enforcement and capping

### ✅ Data Hash Attestations
- Authorized issuer attestation and revocation
- Immediate validation (no maturation for data)
- Expiry handling and TTL enforcement
- Multi-issuer scenarios

### ✅ Resolver Functionality
- `currentOwner()` with maturation window enforcement
- `isDataHashValid()` with issuer authorization checks
- Competing claims resolution
- Expiry and policy enforcement

### ✅ Integration Scenarios
- Complex multi-party ownership transitions
- Maturation window testing with time manipulation
- Issuer authorization changes impact
- Full lifecycle testing

## Running Tests

### All Tests
```bash
cd /Users/atom/Projects/oma3/app-registry-evm-solidity
npm test
```

### Specific Test Files
```bash
# Core functionality tests
npx hardhat test test/OMA3ResolverWithStore.ts

# Integration tests
npx hardhat test test/OMA3ResolverIntegration.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npm run coverage
```

### Individual Test Categories
```bash
# Just deployment tests
npx hardhat test test/OMA3ResolverWithStore.ts --grep "Deployment"

# Just issuer management tests  
npx hardhat test test/OMA3ResolverWithStore.ts --grep "Issuer Authorization"

# Just maturation window tests
npx hardhat test test/OMA3ResolverIntegration.ts --grep "Maturation Window"

# Just EIP-712 delegated tests
npx hardhat test test/OMA3ResolverWithStore.ts --grep "EIP-712 Delegated"
```

## Key Testing Areas

### Policy Enforcement
- **Maturation Window**: 48-hour delay for ownership changes to take effect
- **TTL Limits**: 2-year maximum TTL enforcement 
- **Issuer Authorization**: Only allowlisted issuers can attest data hashes

### Security Features
- **EIP-712 Signatures**: Proper domain separation and type checking
- **Nonce Management**: Replay attack prevention for delegated operations
- **Access Control**: Owner-only functions for policy configuration

### Edge Cases
- Expired attestations handling
- Zero expiry (non-expiring) attestations  
- Competing ownership claims resolution
- Issuer authorization changes mid-attestation

## Test Utilities

### TestHelper Class
Provides common utilities for:
- Address to bytes32 conversion
- Timestamp generation (past/future)
- EIP-712 domain and signature creation
- Entry verification helpers
- Time manipulation shortcuts

### MockWallets
Predefined wallet addresses for consistent testing scenarios.

### TestScenarios
Pre-built scenario builders for complex integration tests.

## Mock Test Addresses

For testing scenarios, these mock addresses are used:
- **ISSUER_1**: `0x1111111111111111111111111111111111111111`
- **ISSUER_2**: `0x2222222222222222222222222222222222222222`
- **USER_1**: `0x3333333333333333333333333333333333333333`
- **USER_2**: `0x4444444444444444444444444444444444444444`
- **ATTACKER**: `0x5555555555555555555555555555555555555555`

## Integration with Existing Tests

These tests are designed to work alongside existing OMA3 registry tests:
- Uses same Hardhat configuration
- Compatible with existing test patterns
- Follows same coding style and structure
- Can be run together with other test suites

## Next Steps for Test Engineer

1. **Expand Edge Cases**: Add more complex scenarios based on production usage
2. **Gas Optimization Tests**: Add gas usage benchmarks for operations
3. **Stress Testing**: Add tests with large numbers of issuers/attestations  
4. **Fuzzing**: Add property-based testing for critical functions
5. **End-to-End**: Integration with frontend applications and real wallet interactions

## Notes

- Tests use Hardhat's time manipulation features for maturation window testing
- EIP-712 signature testing uses real cryptographic operations
- All tests should pass consistently across different network configurations
- Coverage reports will highlight any gaps in test coverage
