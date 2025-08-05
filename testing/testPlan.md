# OMA3AppRegistry Test Plan

Comprehensive testing plan for the OMA3AppRegistry contract to ensure full functionality, security, and edge case coverage.

## Test Environment Setup

### Prerequisites
```bash
# Required tools
npm install --save-dev @nomicfoundation/hardhat-chai-matchers
npm install --save-dev @openzeppelin/test-helpers
npm install --save-dev @types/chai

# Gas reporting
npm install --save-dev hardhat-gas-reporter

# Coverage analysis  
npm install --save-dev solidity-coverage
```

### Test Configuration
```javascript
// hardhat.config.ts - Add to existing config
module.exports = {
  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
```

## 1. Core Functionality Tests

### 1.1 Minting Tests

#### Basic Minting
- [x] Mint with valid parameters
- [x] Verify token ownership and ID assignment
- [x] Check storage mappings are correctly populated
- [x] Verify events are emitted correctly
- [x] Test sequential token ID assignment

#### Minting Edge Cases
- [ ] **Critical**: Mint with version 0.0.0 (test `latestMajor` fix)
- [ ] **Critical**: Mint multiple major versions of same DID
- [ ] Mint with maximum length DID (128 chars)
- [ ] Mint with maximum length URLs (256 chars)
- [ ] Mint with maximum keywords (20)
- [ ] Mint with empty optional fields (fungibleTokenId, contractId)
- [ ] Mint with all interface types (1, 2, 4, 5, 6, 7)

#### Minting Failure Cases
- [ ] Empty DID string
- [ ] DID too long (>128 chars)
- [ ] Empty data URL
- [ ] Data URL too long (>256 chars)
- [ ] Interfaces = 0
- [ ] Too many keywords (>20)
- [ ] Duplicate (DID, major) combination
- [ ] Fungible token inconsistency for existing DID

### 1.2 Update Tests

#### updateAppControlled Tests
- [ ] **Critical**: Test semantic versioning rules enforcement
- [ ] Interface addition (minor increment required)
- [ ] Interface removal (should fail)
- [ ] Data URL update (patch increment required)
- [ ] Keyword update (patch increment + new data hash required)
- [ ] Combined updates (interface + data)
- [ ] No-change updates (should fail)

#### updateStatus Tests
- [ ] **Critical**: Active → Inactive (test active array manipulation)
- [ ] **Critical**: Inactive → Active (test active array addition)
- [ ] Status change with no effect (same status)
- [ ] All status transitions (0→1, 0→2, 1→0, 1→2, 2→0, 2→1)

#### Version History Tests
- [ ] Version history grows correctly on updates
- [ ] Version validation prevents downgrades
- [ ] Complex version sequences (1.0.0 → 1.1.0 → 1.1.1 → 1.2.0)

### 1.3 Query Tests

#### getApp Tests
- [ ] Retrieve app by valid DID + major
- [ ] Failure on non-existent DID
- [ ] Failure on non-existent major version
- [ ] Verify all fields are returned correctly

#### Pagination Tests
- [ ] **Critical**: `getAppsByStatus` pagination consistency
- [ ] Empty result sets
- [ ] Single page results
- [ ] Multi-page results
- [ ] `nextStartIndex` accuracy
- [ ] Page size limits (MAX_APPS_PER_PAGE)

## 2. Stress Tests & Edge Cases

### 2.1 Active Apps Array Manipulation Stress Test

**Priority: Critical** - Tests the array operations where we removed bounds checks

#### Test Scenarios
```javascript
describe("Active Apps Array Stress Test", function() {
  it("should handle rapid status changes without bounds errors", async function() {
    // 1. Mint 100 apps (all start as active)
    // 2. Rapidly change status: active→inactive→active
    // 3. Verify no bounds violations or array corruption
    // 4. Check final active array integrity
  });

  it("should handle edge case: deactivate last remaining active app", async function() {
    // 1. Mint 1 app
    // 2. Change status to inactive
    // 3. Verify array is empty but no underflow
  });

  it("should handle reactivation after all apps deactivated", async function() {
    // 1. Mint multiple apps
    // 2. Deactivate all
    // 3. Reactivate one
    // 4. Verify array rebuilt correctly
  });
});
```

#### Array Integrity Checks
- [ ] Verify `_activeTokenIds.length` matches count of active apps
- [ ] Verify `_activeTokenIdToIndex` mapping consistency
- [ ] No duplicate entries in active array
- [ ] No gaps or invalid token IDs in active array

### 2.2 Registration Tracking Stress Test

**Test the registration mapping changes (didHash vs didString)**

```javascript
describe("Registration Tracking", function() {
  it("should only record first registration per DID", async function() {
    // 1. Mint app with DID "did:test:123" major 1
    // 2. Record initial block/timestamp
    // 3. Mint same DID major 2
    // 4. Verify registration data unchanged
  });

  it("should handle hash collisions gracefully", async function() {
    // Generate DIDs with same hash (if possible) and test
  });
});
```

### 2.3 Version 0.x.x Handling

**Critical test for the `latestMajor` fix**

```javascript
describe("Version 0.x.x Support", function() {
  it("should handle major version 0 correctly", async function() {
    // 1. Mint app with version 0.1.0
    // 2. Verify latestMajor returns 0 (not error)
    // 3. Mint app with version 0.2.0  
    // 4. Verify latestMajor still returns 0
    // 5. Mint app with version 1.0.0
    // 6. Verify latestMajor returns 1
  });

  it("should distinguish between non-existent DID and version 0", async function() {
    // 1. Call latestMajor on non-existent DID (should revert)
    // 2. Mint app with version 0.0.0
    // 3. Call latestMajor (should return 0, not revert)
  });
});
```

## 3. Gas Optimization Tests

### 3.1 Gas Benchmarking
```javascript
describe("Gas Optimization", function() {
  it("should measure mint gas costs", async function() {
    // Test various scenarios and record gas usage
    // - Minimal mint (no keywords, empty optionals)
    // - Full mint (max keywords, full data)
    // - Compare with/without existing DID
  });

  it("should measure update gas costs", async function() {
    // - Data-only updates
    // - Interface-only updates  
    // - Keyword-only updates
    // - Combined updates
  });

  it("should measure query gas costs", async function() {
    // - getApp vs pagination functions
    // - Active vs inactive status queries
    // - Keyword checking costs
  });
});
```

### 3.2 Storage Optimization Verification
- [ ] Verify struct packing efficiency
- [ ] Test storage slot usage
- [ ] Measure query performance with large datasets

## 4. Security & Access Control Tests

### 4.1 Ownership & Permissions
- [ ] Only token owner can update apps
- [ ] Only token owner can change status
- [ ] Transfer ownership affects permissions
- [ ] Approved operators have correct permissions
- [ ] Contract owner permissions (if any)

### 4.2 Reentrancy Protection
```javascript
describe("Reentrancy Protection", function() {
  it("should prevent reentrancy in mint", async function() {
    // Use malicious contract to attempt reentrancy
  });

  it("should prevent reentrancy in updates", async function() {
    // Test all update functions for reentrancy protection
  });
});
```

### 4.3 Input Validation & Bounds
- [ ] **Fuzz testing**: Random inputs to all functions
- [ ] **Overflow testing**: Maximum values for all numeric inputs
- [ ] **Memory safety**: Large arrays and strings
- [ ] **Hash collision testing**: Attempt to find DID hash collisions

## 5. ERC721 Compatibility Tests

### 5.1 Standard Compliance
- [ ] All ERC721 functions work correctly
- [ ] Interface detection (supportsInterface)
- [ ] Token enumeration (custom totalSupply)
- [ ] Metadata URI generation
- [ ] Transfer functionality

### 5.2 Marketplace Integration
- [ ] OpenSea/marketplace compatibility
- [ ] Approval mechanisms
- [ ] Safe transfer callbacks
- [ ] Batch operations (if supported)

## 6. Event System Tests

### 6.1 Event Emission
- [ ] All events emit correct data
- [ ] Indexed fields are properly indexed
- [ ] Event log integrity during batch operations

### 6.2 Event Query Performance
```javascript
describe("Event Querying", function() {
  it("should efficiently filter events by DID hash", async function() {
    // Mint many apps, query events for specific DID
  });

  it("should handle large event logs", async function() {
    // Generate thousands of events, test query performance
  });
});
```

## 7. Data Integrity Tests

### 7.1 Consistency Checks
- [ ] **Critical**: Storage mapping consistency across all operations
- [ ] Version history integrity
- [ ] Keyword hash storage/retrieval
- [ ] Registration tracking accuracy

### 7.2 Hash Function Tests
- [ ] DID hash consistency
- [ ] Keyword hash uniqueness
- [ ] Data hash verification

## 8. Performance & Scalability Tests

### 8.1 Large Dataset Tests
```javascript
describe("Scalability", function() {
  it("should handle 10,000+ apps efficiently", async function() {
    // Mint large number of apps
    // Test query performance
    // Verify gas costs remain reasonable
  });

  it("should handle pagination with large datasets", async function() {
    // Test pagination edge cases with large datasets
  });
});
```

### 8.2 Memory Usage Tests
- [ ] Stack depth for recursive operations
- [ ] Memory allocation for large arrays
- [ ] Contract size optimization

## 9. Integration Tests

### 9.1 Multi-User Scenarios
```javascript
describe("Multi-User Integration", function() {
  it("should handle concurrent operations from multiple users", async function() {
    // Simulate multiple users minting/updating simultaneously
  });

  it("should maintain data isolation between users", async function() {
    // Verify user A cannot affect user B's apps
  });
});
```

### 9.2 Upgrade Simulation
- [ ] Test behavior during contract upgrades (if proxy pattern used)
- [ ] Data migration scenarios
- [ ] Backward compatibility requirements

## 10. Specialized Test Scenarios

### 10.1 Keyword System Tests
```javascript
describe("Keyword System", function() {
  it("should handle keyword hash collisions", async function() {
    // Test what happens with duplicate keyword hashes
  });

  it("should optimize keyword search performance", async function() {
    // Measure hasAnyKeywords vs hasAllKeywords performance
  });
});
```

### 10.2 Interface Bitmap Tests
- [ ] All valid bitmap combinations (1-7)
- [ ] Invalid bitmap values (>7)
- [ ] Interface addition/removal validation
- [ ] Bitmap storage efficiency

## Test Execution Strategy

### Phase 1: Core Functionality (Days 1-2)
- Basic minting/updating/querying
- Critical edge cases (version 0.x.x, array manipulation)
- Essential security tests

### Phase 2: Stress Testing (Days 3-4)  
- Large dataset performance
- Gas optimization verification
- Array manipulation edge cases

### Phase 3: Integration & Advanced (Days 5-6)
- ERC721 compatibility
- Multi-user scenarios
- Event system testing

### Phase 4: Security Audit (Days 7-8)
- Comprehensive security review
- Fuzz testing
- Edge case discovery

## Success Criteria

- [ ] **100% line coverage** on core contract
- [ ] **Zero critical vulnerabilities** found
- [ ] **Gas costs within acceptable limits** for all operations
- [ ] **Array operations never fail** due to bounds issues
- [ ] **Version 0.x.x handled correctly** in all scenarios
- [ ] **Registration tracking works correctly** with hash-based storage
- [ ] **All ERC721 compatibility tests pass**

## Automated Testing Commands

```bash
# Run full test suite
npm run test

# Run with coverage
npm run coverage

# Run gas reporting
npm run test:gas

# Run specific test categories
npm run test:core
npm run test:stress
npm run test:security

# Run fuzzing tests (if implemented)
npm run test:fuzz
```

---

**Note for Test Engineers**: Pay special attention to the "Critical" marked tests - these cover areas where we made significant changes and removed safety checks. The contract should handle all edge cases gracefully without external bounds checking. 