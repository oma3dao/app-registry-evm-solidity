# Admin Tasks

Granular, single-purpose admin tasks for managing deployed OMA3 contracts.

**Note:** This is for development and test contracts only. Production contracts will be administered using multi-sig wallets.

## Philosophy

Each admin task does **one thing only**. This provides:
- ✅ Clear audit trail (one transaction per action)
- ✅ Safer operations (no partial failures)
- ✅ Easier to understand and reason about
- ✅ Composable (chain tasks together as needed)

## Authentication

All admin tasks use `getSecureSigner()` which loads a private key from `~/.ssh/test-evm-deployment-key`. This must be the same key that deployed the contracts and currently owns them.

---

## Viewing & Testing

### resolver-view-attestations

View attestations in the resolver contract. Useful for testing DID verification and debugging.

```bash
# View attestations by DID
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --did "did:web:example.com"

# View attestations by issuer
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --issuer 0x7F16C09c3FDA956dD0CC3E21820E691EdD44B319

# View attestations by DID from specific issuer
npx hardhat resolver-view-attestations \
  --network omachainTestnet \
  --did "did:web:example.com" \
  --issuer 0x7F16C09c3FDA956dD0CC3E21820E691EdD44B319
```

**Output:**
- Lists all authorized issuers
- Shows current resolved owner for a DID
- Displays attestation details (controller, timestamps, expiration)
- Shows active/revoked status
- Event history for issuers

---

## Registry Administration

### registry-set-metadata-contract

Set the metadata contract address in the registry.

```bash
npx hardhat registry-set-metadata-contract \
  --metadata 0x13aD113D0DE923Ac117c82401e9E1208F09D7F19 \
  --network omachainTestnet
```

### registry-set-ownership-resolver

Set the ownership resolver address in the registry.

```bash
npx hardhat registry-set-ownership-resolver \
  --resolver 0xe4E8FBf35b6f4D975B4334ffAfaEfd0713217cAb \
  --network omachainTestnet
```

### registry-set-dataurl-resolver

Set the data URL resolver address in the registry.

```bash
npx hardhat registry-set-dataurl-resolver \
  --resolver 0xe4E8FBf35b6f4D975B4334ffAfaEfd0713217cAb \
  --network omachainTestnet
```

### registry-set-require-attestation

Enable or disable the requirement for dataUrl attestations when minting apps.

```bash
# Enable attestation requirement (production mode)
npx hardhat registry-set-require-attestation \
  --require true \
  --network omachainTestnet

# Disable attestation requirement (testing/development mode - DEFAULT)
npx hardhat registry-set-require-attestation \
  --require false \
  --network omachainTestnet
```

**When enabled:**
- Apps must have dataHash attestations from the resolver to be minted
- Enforces data integrity via trusted oracles
- Production-ready mode

**When disabled (default):**
- Apps can be minted without attestations
- Faster development and testing
- No dependency on resolver oracle

**Note:** The flag defaults to `false` (disabled). Enable it once your resolver is properly configured and you're ready for production.

### registry-transfer-owner

Transfer ownership of the registry to a new address.

```bash
npx hardhat registry-transfer-owner \
  --new-owner 0x1234567890123456789012345678901234567890 \
  --network omachainTestnet
```

**⚠️ WARNING:** After transferring ownership, you will no longer be able to manage the registry.

---

## Metadata Administration

### metadata-authorize-registry

Authorize a registry contract to write to the metadata contract.

```bash
npx hardhat metadata-authorize-registry \
  --registry 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83 \
  --network omachainTestnet
```

### metadata-transfer-owner

Transfer ownership of the metadata contract to a new address.

```bash
npx hardhat metadata-transfer-owner \
  --new-owner 0x1234567890123456789012345678901234567890 \
  --network omachainTestnet
```

**⚠️ WARNING:** After transferring ownership, you will no longer be able to manage the metadata contract.

---

## Resolver Administration

### resolver-set-maturation

Set how long (in seconds) before ownership changes take effect.

```bash
# Set to 1 hour
npx hardhat resolver-set-maturation \
  --duration 3600 \
  --network omachainTestnet

# Set to 48 hours (default)
npx hardhat resolver-set-maturation \
  --duration 172800 \
  --network omachainTestnet
```

### resolver-set-max-ttl

Set the maximum time-to-live (in seconds) for attestations.

```bash
# Set to 2 years (default)
npx hardhat resolver-set-max-ttl \
  --duration 63072000 \
  --network omachainTestnet

# Set to 1 year
npx hardhat resolver-set-max-ttl \
  --duration 31536000 \
  --network omachainTestnet
```

### resolver-add-issuer

Authorize an address to create attestations.

```bash
npx hardhat resolver-add-issuer \
  --issuer 0x1234567890123456789012345678901234567890 \
  --network omachainTestnet
```

**Common issuers to authorize:**
- Your server wallet (for `/api/verify-did` endpoint)
- Registry contract (for automated attestations)
- Trusted third-party services

### resolver-remove-issuer

Revoke authorization for an address to create attestations.

```bash
npx hardhat resolver-remove-issuer \
  --issuer 0x1234567890123456789012345678901234567890 \
  --network omachainTestnet
```

### resolver-transfer-owner

Transfer ownership of the resolver to a new address.

```bash
npx hardhat resolver-transfer-owner \
  --new-owner 0x1234567890123456789012345678901234567890 \
  --network omachainTestnet
```

**⚠️ WARNING:** After transferring ownership, you will no longer be able to manage the resolver.

---

## After Deployment

The `deploy-system` task automatically configures all contract linkages during deployment. The most common post-deployment task is authorizing your server wallet:

```bash
# 1. Authorize server wallet for DID verification API
npx hardhat resolver-add-issuer \
  --issuer 0xYourServerWallet \
  --network omachainTestnet

# 2. Verify deployment
npx hardhat get-apps --network omachainTestnet
```

---

## Contract Address Resolution

All tasks automatically load contract addresses from `hardhat.config.ts` → `NETWORK_CONTRACTS`. You can override with flags:

- `--registry 0x...` - Override registry address
- `--metadata 0x...` - Override metadata address
- `--resolver 0x...` - Override resolver address

---

## Security Notes

1. **Development/Testing:**
   - Uses SSH key from `~/.ssh/test-evm-deployment-key`
   - Same wallet that deployed contracts
   - ⚠️ SSH keys vulnerable to IDE extension attacks
   - Only use with test keys and small amounts

2. **Production:**
   - Use multi-sig wallet (Gnosis Safe, etc.)
   - Hardware wallet signing when possible
   - Time-delayed operations for critical changes
   - Never use SSH keys for production

---

## Troubleshooting

### "Signer is not the contract owner"
The wallet in `~/.ssh/test-evm-deployment-key` must match the deployer wallet. Check `contract-addresses.txt` for the deployer address.

### "Contract address not set"
Update `hardhat.config.ts` → `NETWORK_CONTRACTS` with deployed addresses, or use override flags like `--registry 0x...`.

### "Private key not found"
Ensure `~/.ssh/test-evm-deployment-key` exists and contains a valid private key, or set `DEPLOYMENT_KEY_PATH` environment variable.