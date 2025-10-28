# EAS Complete Workflow Example

This guide shows a complete end-to-end workflow for using EAS (Ethereum Attestation Service).

## Scenario: App Rating System

We'll create a simple app rating system where users can attest to an app's quality with a name and score.

### Step 1: Deploy EAS System

```bash
npx hardhat deploy-eas-system --network omachainTestnet --confirmations 1
```

**Output:**
```
SchemaRegistry: 0x1234...
EAS: 0x5678...
```

**Action:** Update `hardhat.config.ts` with these addresses.

### Step 2: Register a Schema

```bash
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "string appName,uint8 rating,string review"
```

**Output:**
```
📋 Schema UID: 0xabcd1234...
```

**Save this UID!** You'll need it for creating attestations.

### Step 3: Create an Attestation

```bash
# User "Alice" rates an app
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xabcd1234... \
  --recipient 0xAPP_OWNER_ADDRESS \
  --types "string,uint8,string" \
  --values "MyAwesomeApp,95,Great app! Very useful."
```

**Output:**
```
✅ Attestation UID: 0xdef5678...
```

### Step 4: View the Attestation

```bash
npx hardhat eas-get-attestation \
  --network omachainTestnet \
  --uid 0xdef5678...
```

**Output:**
```
✅ Attestation Details:
UID: 0xdef5678...
Schema: 0xabcd1234...
Attester: 0xALICE_ADDRESS
Recipient: 0xAPP_OWNER_ADDRESS
Time: 2024-01-15T10:30:00.000Z
Expiration: Never
Revocable: true
Revocation Time: Not revoked
Data: 0x... (encoded)
```

### Step 5: Create More Attestations

```bash
# User "Bob" rates the same app
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xabcd1234... \
  --recipient 0xAPP_OWNER_ADDRESS \
  --types "string,uint8,string" \
  --values "MyAwesomeApp,88,Good app but needs more features."

# User "Charlie" rates the app
npx hardhat eas-attest \
  --network omachainTestnet \
  --schema 0xabcd1234... \
  --recipient 0xAPP_OWNER_ADDRESS \
  --types "string,uint8,string" \
  --values "MyAwesomeApp,100,Perfect! Exactly what I needed."
```

### Step 6: (Optional) Revoke an Attestation

If Alice changes her mind:

```bash
npx hardhat eas-revoke \
  --network omachainTestnet \
  --schema 0xabcd1234... \
  --uid 0xdef5678...
```

## Common Schema Examples

### User Profile
```bash
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "string username,string bio,string avatarUrl"
```

### App Ownership
```bash
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "string did,address owner,uint256 timestamp"
```

### Reputation Score
```bash
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "address user,uint256 score,string category"
```

### KYC Verification
```bash
npx hardhat eas-register-schema \
  --network omachainTestnet \
  --schema "address user,bool verified,uint256 expiryDate,string verifierName"
```

## Tips

1. **Schema Design**: Keep schemas simple and focused. You can always create multiple schemas for different purposes.

2. **Data Types**: Supported types include:
   - `string` - Text data
   - `uint8`, `uint256` - Numbers
   - `address` - Ethereum addresses
   - `bool` - True/false
   - `bytes32` - Fixed-size data

3. **Revocability**: Set `--revocable false` for permanent attestations (like diplomas or certificates).

4. **Expiration**: Use `--expiration` for time-limited attestations (like subscriptions or temporary access).

5. **Resolvers**: Use custom resolvers for advanced features like:
   - Rate limiting (prevent spam)
   - Gasless attestations (pay gas for users)
   - Custom validation logic

## Integration with Frontend

Once you have attestations, query them in your frontend:

```typescript
const eas = new ethers.Contract(EAS_ADDRESS, EAS_ABI, provider);
const attestation = await eas.getAttestation(attestationUID);

// Decode the data
const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
  ["string", "uint8", "string"],
  attestation.data
);

console.log(`App: ${decoded[0]}, Rating: ${decoded[1]}, Review: ${decoded[2]}`);
```

## Next Steps

- Set up an indexer to query attestations efficiently
- Create a frontend UI for creating/viewing attestations
- Deploy custom resolvers for your specific use case
- Integrate with your existing OMA3 app registry
