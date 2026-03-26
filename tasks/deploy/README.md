# OMATrust Deployment Guide

Step-by-step checklists for deploying OMATrust contracts to a new chain. There are two workflows depending on chain type.

## Which Workflow?

| Chain Type                                | What to Deploy                         | EAS                          |
|-------------------------------------------|----------------------------------------|------------------------------|
| **OMAchain** (devnet/testnet/mainnet)     | Full system + EAS + TimelockController | Deploy EAS (no existing EAS) |
| **External chain** (Base, Arbitrum, etc.) | Fee resolver + schemas only            | Use existing EAS             |

Once contracts are deployed and ownership is transferred to the timelock, ongoing admin operations (add/remove issuers, update resolver settings, etc.) are handled through the `oma3-ops` repository. See `oma3-ops/README.md` Part 2.

---

## OMAchain Deployment Checklist

Use this when deploying to OMAchain devnet, testnet, or mainnet. Covers the full system: EAS, reputation schemas, timelock, server wallets, and identity contracts.

Reputation launches first (Phase A). Identity launches after audit (Phase B).

### Prerequisites

- Deployment SSH key funded with native OMA tokens (see [Deployment Key Strategy](#deployment-key-strategy))
- `hardhat.config.ts` has the target network settings configured

---

### Phase A: Reputation + Foundation

This phase sets up server wallets, deploys the TimelockController, EAS, and reputation schemas. The timelock is deployed early (Steps 3-4) to start the delay clock — EAS and reputation work (Steps 5-9) fills the waiting period so the smoke test execution in Step 10 doesn't block progress.

After this phase, the reputation system (delegated attestations, controller witness) is operational.

#### Step 1: Create Server Wallets

Mainnet and Testnet use different wallets and tokens.  Devnet skips server wallets and uses environment variable private keys instead. If server wallets for your environment/chain have not been created in the two Thirdweb projects yet (oma3-frontend project and om3-contract-admin), you need to create them.  

**Wallet 1: Attestation** (oma3-frontend project):
This wallet is shared across both frontends (`app-registry-frontend` and `rep-attestation-frontend`).
1. Create a server wallet. Record the wallet address.
2. Fund with OMA for gas payments.  OMAChain Testnet uses OMA bridged from Sepolia.  OMAChain Mainnet uses OMA bridged from Ethereum Mainnet.

OMAChain Testnet Faucet:  https://faucet.testnet.chain.oma3.org/
OMAChain Mainnet Faucet:  https://faucet.omachain.org (not yet deployed)

**Wallet 2: Admin** (oma3-contract-admin project):
1. Create a server wallet. Record the wallet address.
2. Fund with OMA for gas payments.

Record both wallet addresses in `oma3-ops/approved-addresses.json` immediately. This is the source of truth for all authorized wallet addresses across networks.

**Configure server wallets and secret keys in Vercel:**
Set in both `app-registry-frontend` and `rep-attestation-frontend` environments:
- `THIRDWEB_SECRET_KEY` (oma3-frontend project secret key — the same key manages testnet and mainnet server wallets in the project)
- `THIRDWEB_SERVER_WALLET_ADDRESS` (attestation server wallet address for this environment)

Thirdweb project secret keys should be rotated regularly. Thirdweb project secret keys are stored in Bitwarden only. Do not store secret keys anywyere else- never in Vercel, never in `.env`, never on disk.

**Configure attestation wallet in downstream repos:**
Add the attestation wallet address for this chain in `app-registry-frontend/src/config/controller-witness-config.ts` → `APPROVED_CONTROLLER_WITNESS_ATTESTERS[<chainId>]`.

#### Step 2: Compile

```bash
npx hardhat compile
```

This compiles all Solidity contracts and generates artifacts needed for deployment.

#### Step 3: Deploy TimelockController

The TimelockController is from OpenZeppelin Contracts ([source](https://github.com/OpenZeppelin/openzeppelin-contracts)). The exact version is pinned in `package.json` and `package-lock.json`, and recorded in `contract-addresses.txt` at deployment time (see [Dependency Versioning Strategy](../../README.md#dependency-versioning-strategy)).

The `--proposer` is the admin server wallet address created in Step 1.

```bash
npx hardhat deploy-timelock \
  --network <NETWORK> \
  --proposer <ADMIN_WALLET_ADDRESS> \
  --delay 86400
```

| Parameter     | Testnet                          | Mainnet                          |
|---------------|----------------------------------|----------------------------------|
| `--network`   | `omachainTestnet`                | `omachainMainnet`                |
| `--delay`     | `86400` (24h) — default          | `432000` (5 days) — default      |
| `--proposer`  | Testnet admin wallet address     | Mainnet admin wallet address     |

The mainnet delay is 5 days to allow time for incident response (e.g., Thirdweb outage, compromised key rotation) before any scheduled admin operation executes.

**Important**
Update `oma3-ops/src/admin-wallet/config.ts` with the deployed timelock address.

#### Step 4: Smoke Test Timelock

<!-- SYNC: Smoke test commands also documented in oma3-ops/README.md Part 2 "Smoke Tests" section. Update both when changing flags or script names. -->

Verify the admin server wallet can propose and that unauthorized wallets cannot. This script checks roles, submits a zero-value self-call proposal, and tests the negative case — all in one run.

```bash
# From oma3-ops/
npm run admin:timelock-smoke-test -- \
  --network <NETWORK> \
  --timelock <TIMELOCK_ADDRESS> \
  --admin <ADMIN_WALLET_ADDRESS>
```

What the script does:
1. Verifies admin wallet has `PROPOSER_ROLE` and `EXECUTOR_ROLE` on the timelock
2. Verifies the timelock is self-administered (`DEFAULT_ADMIN_ROLE` held by the timelock itself, not an external address)
3. Attempts to schedule from a non-proposer wallet — confirms it reverts (negative test)
4. Schedules a zero-value self-call via the admin server wallet (prompts for Bitwarden secret key)
5. Prints `operation-id`, `salt`, and earliest execution time

Save `operation-id` and `salt` — you'll use them in Step 10 after the timelock delay has passed. Continue with Steps 5-9 while waiting for the delay to elapse.

#### Step 5: Deploy EAS

```bash
npx hardhat deploy-eas-system --network <NETWORK> --confirmations 1
```

This deploys:
- **SchemaRegistry**: Manages attestation schemas
- **EAS**: Main attestation contract

Save the addresses from the output:
```
SchemaRegistry: 0x1234...
EAS: 0x5678...
```

#### Step 6: Update EAS Configuration Files

Update EAS contract addresses in all four repositories that reference them. Use the SchemaRegistry and EAS addresses from the Step 5 deployment output.

| #   | File                                                    | Fields to update                                                                    |
|-----|---------------------------------------------------------|-------------------------------------------------------------------------------------|
| 1   | `app-registry-evm-solidity/hardhat.config.ts`           | `NETWORK_CONTRACTS.<network>.easSchemaRegistry`, `.easContract`                     |
| 2   | `rep-attestation-tools-evm-solidity/hardhat.config.ts`  | `EAS_SCHEMA_REGISTRY_ADDRESSES.<network>`, `EAS_CONTRACT_ADDRESSES.<network>`       |
| 3   | `rep-attestation-frontend/src/config/chains.ts`         | `<network>.contracts.easSchemaRegistry`, `.easContract`                             |
| 4   | `app-registry-frontend/src/config/chains.ts`            | `<network>.contracts.easContract`                                                   |

#### Step 7: Verify EAS Deployment

```bash
npx hardhat eas-sanity --network <NETWORK>
```

What the test does:
1. Registers a test schema
2. Creates a test attestation
3. Verifies retrieval works correctly

If all steps pass, EAS is working. If the test fails, check that EAS addresses are correctly configured in `hardhat.config.ts`.

#### Step 8: Deploy Reputation Schemas

Run the following commands for each schema (substituting the file name obviously).

```bash
# From rep-attestation-tools-evm-solidity/
npx hardhat generate-eas-object --schema schemas-json/endorsement.schema.json --network <NETWORK>
npx hardhat deploy-eas-schema --file generated/Endorsement.eastest.json --network <NETWORK>
```

Once all schemas are deployed, update the frontend repositories.

```bash
# From rep-attestation-frontend/
npm run update-schemas ../rep-attestation-tools-evm-solidity
cp ./src/config/schemas.ts ../app-registry-frontend/src/config/schemas.ts
```

See the [rep-attestation-tools-evm-solidity README](../../../rep-attestation-tools-evm-solidity/README.md) for complete schema deployment instructions.

#### Step 9: Verify Reputation End-to-End

Verify the full reputation flow works:

1. Delegated EAS attestation succeeds (rep-attestation-frontend `/api/eas/delegated-attest`)
2. Controller witness attestation succeeds (app-registry-frontend `/api/controller-witness`)
3. Verify the attester recorded in EAS is the end user's address (not the relayer)

After verification remove old private keys from Vercel (except Devnet), if any:
- `ISSUER_PRIVATE_KEY` from app-registry-frontend
- `EAS_DELEGATE_PRIVATE_KEY` from rep-attestation-frontend

The reputation system is now operational.

#### Step 10: Confirm Timelock Smoke Test

The timelock delay from Step 4 should have passed by now (24h testnet / 5 days mainnet). Before executing, advance the chain clock by submitting a few transactions — on a fresh chain, block timestamps lag behind wall clock time:

```bash
# From oma3-ops/ — run 2-3 times to advance block timestamps
npm run admin:test-wallet -- --network <NETWORK>
```

Then execute the smoke test proposal:

```bash
# From oma3-ops/
npm run admin:timelock-smoke-execute -- \
  --network <NETWORK> \
  --timelock <TIMELOCK_ADDRESS> \
  --operation-id <OPERATION_ID_FROM_STEP_4> \
  --salt <SALT_FROM_STEP_4>
```

What the script does:
1. Checks the proposal is ready (delay has elapsed)
2. Executes the zero-value self-call via the admin server wallet
3. Confirms execution succeeded on-chain

If this fails, debug before proceeding to Phase B. The timelock must work before you transfer contract ownership to it.

**Chain clock drift on fresh chains:** The timelock checks `block.timestamp`, not wall clock time. On a newly deployed OMAchain with few transactions, block timestamps can fall behind real time because blocks only advance when transactions are submitted. If the script says "not ready" but your wall clock says the delay has passed, submit a few transactions to bump the chain forward (e.g., `npm run admin:test-wallet -- --network <NETWORK>`), then retry. This is expected on any fresh chain — the remaining deployment steps will naturally advance the clock.

Phase A complete. The reputation system is operational. Proceed to Phase B when identity contracts are ready.

#### Phase A Checklist

- [ ] Server wallet addresses recorded in `oma3-ops/approved-addresses.json`
- [ ] Timelock address updated in `oma3-ops/src/admin-wallet/config.ts`
- [ ] Timelock smoke test round-trip succeeded (propose → wait → execute)
- [ ] EAS addresses updated in all four repos (see Step 6 table)
- [ ] Schemas deployed and `schemas.ts` updated in both `rep-attestation-frontend` and `app-registry-frontend` (via `update-schemas`)
- [ ] Vercel env vars set (`THIRDWEB_SECRET_KEY`, `THIRDWEB_SERVER_WALLET_ADDRESS`) in both frontends
- [ ] Attestation wallet added to `APPROVED_CONTROLLER_WITNESS_ATTESTERS`
- [ ] Delegated EAS attestation works end-to-end
- [ ] Controller witness attestation works end-to-end
- [ ] Old private keys removed from Vercel (`ISSUER_PRIVATE_KEY`, `EAS_DELEGATE_PRIVATE_KEY`)

---

### Phase B: Identity (After Audit)

This phase deploys the identity contracts (Registry, Metadata, Resolver), configures them, adds the attestation wallet as an issuer, transfers all contract ownership to the timelock, and verifies the full identity flow.

#### Step 1: Deploy Identity Contracts (Registry + Metadata + Resolver)

```bash
npx hardhat deploy-system \
  --network <NETWORK> \
  --confirmations 1 \
  --update-abis ../app-registry-frontend
```

This will:
- Deploy Registry, Metadata, and Resolver contracts
- Automatically link them together
- Run integration tests
- Update frontend ABIs (if `--update-abis` specified)
- Save deployment info to `contract-addresses.txt`

If you didn't use `--update-abis`, run this separately:
```bash
npx hardhat update-frontend-abis --target-path ../app-registry-frontend
```

Note: If contracts on different chains have different ABIs, the frontend will need per-chain ABI loading. The current `update-frontend-abis` task copies one set of ABIs and assumes all chains run the same contract version. This is a known limitation — if you deploy a newer contract version to one chain, you'll need to handle ABI versioning in the frontend separately.

#### Step 2: Update Identity Configuration Files

All tasks rely on the correct contract addresses. Update BEFORE running any tasks against the new contracts.

The deploy task automatically writes to `contract-addresses.txt` — use it as the source of truth for the addresses below.

| #   | File                                                    | Fields to update                                                 |
|-----|---------------------------------------------------------|------------------------------------------------------------------|
| 1   | `app-registry-evm-solidity/hardhat.config.ts`           | `NETWORK_CONTRACTS.<network>.registry`, `.metadata`, `.resolver` |
| 2   | `app-registry-frontend/src/config/chains.ts`            | `<network>.contracts.registry`, `.metadata`, `.resolver`         |
| 3   | `oma3-ops/src/admin-wallet/config.ts`                   | `contracts.registry`, `.metadata`, `.resolver`                   |

#### Step 3: Configure Resolver

```bash
# Maturation period (0 for devnet/testnet, 172800 for mainnet)
npx hardhat resolver-set-maturation --network <NETWORK> --duration <SECONDS>

# Max TTL (2 years = 63072000)
npx hardhat resolver-set-max-ttl --network <NETWORK> --duration <SECONDS>
```

#### Step 4: Transfer Ownership to Timelock

These are the last commands that use the SSH deployment key for admin purposes.

```bash
npx hardhat registry-transfer-owner --network <NETWORK> --new-owner <TIMELOCK_ADDRESS>
npx hardhat metadata-transfer-owner --network <NETWORK> --new-owner <TIMELOCK_ADDRESS>
npx hardhat resolver-transfer-owner --network <NETWORK> --new-owner <TIMELOCK_ADDRESS>
```

After this, all admin operations go through the timelock via the admin server wallet. The deployment SSH key is now powerless and can optionally be deleted.

#### Step 5: Verify Ownership Transfer

Verify the deployment key is locked out by attempting an admin operation with the deployment key (e.g., `resolver-add-issuer`) — confirm it reverts with an ownership error.

#### Step 6: Add Attestation Wallet as Issuer via Timelock and test Identity Admin

<!-- SYNC: Propose/execute commands also documented in oma3-ops/README.md Part 2 "Admin Operations" section. Update both when changing flags or script names. -->

This is the first real admin operation through the timelock. Add the attestation wallet (from Phase A Step 1) as an authorized issuer on the resolver. If this fails, debug before proceeding — the timelock must work for all future admin operations.

```bash
# From oma3-ops/
npm run admin:propose-resolver-add-issuer -- \
  --network <NETWORK> \
  --issuer <ATTESTATION_WALLET_ADDRESS>

# Wait for timelock delay (24h testnet / 5 days mainnet)
# Use the --target, --calldata, and --salt from the propose output:

npm run admin:execute-proposal -- \
  --network <NETWORK> \
  --target <TARGET_FROM_PROPOSE> \
  --calldata <CALLDATA_FROM_PROPOSE> \
  --salt <SALT_FROM_PROPOSE>
```

Verify:
```bash
npx hardhat resolver-view-attestations --network <NETWORK>
```

Then test admin on the registry contract as well — enable the dataUrl attestation requirement:

```bash
# From oma3-ops/
npm run admin:propose-registry-set-require-attestation -- \
  --network <NETWORK> \
  --require true

# Wait for timelock delay, then execute using the output from the propose command.
```

This confirms the timelock works against both the resolver and the registry. Without an authorized issuer, minting will fail.

For mainnet: complete both round-trips on testnet first. On mainnet, the 5-day wait is intentional — do not proceed until both succeed. If either fails, the identity contracts are fresh with no data — redeploy them, fix what went wrong, and retry.

#### Step 7: Verify on Block Explorer (optional)

Uploads Solidity source code to the block explorer for transparency.

```bash
export OMACHAIN_API_KEY=your_api_key_here  # If required by explorer

npx hardhat verify --network <NETWORK> <REGISTRY_ADDRESS>
npx hardhat verify --network <NETWORK> <METADATA_ADDRESS>
npx hardhat verify --network <NETWORK> <RESOLVER_ADDRESS>
```

If verification fails, contracts still work. Verification is only for transparency.

#### Step 8: Verify Identity End-to-End

```bash
# Check contract status and configuration
npx hardhat check-contracts --network <NETWORK>

# Should return empty array for new deployment
npx hardhat get-apps --network <NETWORK>
```

Verify:
1. `check-contracts` shows all contracts linked correctly
2. DID ownership attestation succeeds
3. DataUrl attestation succeeds
4. Minting succeeds from the frontend
5. Admin operations work through timelock (add/remove issuer)
6. No raw private keys remain in Vercel environment

Phase B complete. The identity system is operational. For ongoing admin operations, see `oma3-ops/README.md` Part 2.

#### Phase B Checklist

- [ ] Identity contract addresses updated in all three repos (see Step 2 table)
- [ ] Ownership transferred to timelock (registry, metadata, resolver)
- [ ] Deployment key confirmed locked out (admin operation reverts)
- [ ] Attestation wallet added as issuer via timelock (propose → wait → execute)
- [ ] `setRequireDataUrlAttestation` set via timelock (propose → wait → execute)
- [ ] `check-contracts` shows all contracts linked correctly
- [ ] DID ownership, DataUrl attestation, and minting work end-to-end
- [ ] No raw private keys remain in Vercel environment

---

## Upgrading a Single Contract

<!-- SYNC: Script names (propose-resolver-*, propose-registry-*) also listed in oma3-ops/README.md Part 2 scripts table and usage examples. Update both when renaming. -->

Use this when you need to fix a bug in one contract without redeploying everything. The general pattern:

1. Deploy the new contract (uses deployment key — deploying a fresh contract doesn't require timelock)
2. Update addresses in config files BEFORE running any tasks
3. Update frontend ABIs
4. Re-link contracts and re-add issuers as needed

After ownership has been transferred to the timelock, admin operations on existing contracts (re-linking, adding issuers) must go through the timelock propose → wait → execute flow via `oma3-ops`. The Hardhat setup tasks (`tasks/setup/`) only work while the deployment key still owns the contracts.

### Upgrading the Resolver

```bash
# 1. Deploy (deployment key — new contract, no timelock needed)
npx hardhat deploy-resolver --network <NETWORK> --confirmations 1

# 2. Update contract addresses in these 3 files BEFORE running any tasks:
#    - hardhat.config.ts → NETWORK_CONTRACTS.<network>.resolver
#    - app-registry-frontend/src/config/chains.ts
#    - oma3-ops/src/admin-wallet/config.ts → contracts.resolver
#    (contract-addresses.txt is updated automatically by the deploy task)

# 3. Update frontend ABIs
npx hardhat update-frontend-abis --target-path ../app-registry-frontend

# 4. Point Registry to new Resolver (3 proposals — registry ownership is on timelock)
#    From oma3-ops/:
npm run admin:propose-registry-set-resolver -- --network <NETWORK> --type ownership --resolver <NEW_RESOLVER>
npm run admin:propose-registry-set-resolver -- --network <NETWORK> --type dataurl --resolver <NEW_RESOLVER>
npm run admin:propose-registry-set-resolver -- --network <NETWORK> --type registration --resolver <NEW_RESOLVER>

#    Wait for timelock delay, then execute each using the output from the propose commands.

# 5. Re-add authorized issuers (new Resolver starts with NO issuers)
#    From oma3-ops/:
npm run admin:propose-resolver-add-issuer -- --network <NETWORK> --issuer <ISSUER_ADDRESS>

#    Wait for timelock delay, then execute.

# 6. Verify
npx hardhat get-apps --network <NETWORK>
```

### Upgrading the Registry

```bash
# 1. Deploy (deployment key — new contract, no timelock needed)
npx hardhat deploy-registry --network <NETWORK> --confirmations 1

# 2. Update contract addresses (same files as above, plus oma3-ops config.ts)

# 3. Update frontend ABIs
npx hardhat update-frontend-abis --target-path ../app-registry-frontend

# 4. Configure new registry to use existing metadata and resolvers.
#    The NEW registry is owned by the deployment key until ownership is transferred,
#    so these can use Hardhat setup tasks directly:
npx hardhat registry-set-metadata-contract --network <NETWORK> --metadata <EXISTING_METADATA>
npx hardhat registry-set-ownership-resolver --network <NETWORK> --resolver <EXISTING_RESOLVER>
npx hardhat registry-set-dataurl-resolver --network <NETWORK> --resolver <EXISTING_RESOLVER>
npx hardhat registry-set-registration-resolver --network <NETWORK> --resolver <EXISTING_RESOLVER>

#    But metadata-authorize-registry requires ownership of the EXISTING metadata contract,
#    which is on the timelock. From oma3-ops/:
#    (You'll need to add a propose-metadata-authorize-registry script, or use
#    execute-proposal with manually encoded calldata.)

# 5. Transfer new registry ownership to timelock
npx hardhat registry-transfer-owner --network <NETWORK> --new-owner <TIMELOCK_ADDRESS>

# ⚠️ WARNING: All registered apps in the OLD Registry are lost!
```

### Upgrading Metadata

```bash
# 1. Deploy (deployment key — new contract, no timelock needed)
npx hardhat deploy-metadata --network <NETWORK> --confirmations 1

# 2. Update contract addresses (same files as above, plus oma3-ops config.ts)

# 3. Update frontend ABIs
npx hardhat update-frontend-abis --target-path ../app-registry-frontend

# 4. Link to existing Registry.
#    metadata-authorize-registry on the NEW metadata uses the deployment key (new contract):
npx hardhat metadata-authorize-registry --network <NETWORK> --registry <EXISTING_REGISTRY>

#    registry-set-metadata-contract on the EXISTING registry requires timelock.
#    From oma3-ops/, use execute-proposal with manually encoded calldata, or add a
#    propose-set-metadata-contract script.

# 5. Transfer new metadata ownership to timelock
npx hardhat metadata-transfer-owner --network <NETWORK> --new-owner <TIMELOCK_ADDRESS>

# ⚠️ WARNING: All metadata in the OLD Metadata contract is lost!
```

---

## External Chain Deployment Checklist

Use this when deploying to chains that already have EAS (Base, Arbitrum, Optimism, etc.). Only the fee resolver and schemas are needed.

Why a fee resolver? On OMAchain, gas costs serve as spam prevention. On external chains, we collect a fixed fee per attestation to cover operational costs and prevent spam.

### Prerequisites

- EAS contract address on target chain ([EAS Deployments](https://docs.attest.org/docs/quick--start/contracts))
- Treasury address (Gnosis Safe recommended)
- Deployer wallet funded with gas tokens
- Target network configured in `hardhat.config.ts`

### Step 1: Deploy Fee Resolver

```bash
npx hardhat deploy-fee-resolver \
  --network <NETWORK> \
  --eas <EAS_ADDRESS> \
  --fee 0.001 \
  --treasury <TREASURY_ADDRESS>
```

Parameters:

| Parameter          | Description                                       | Example                                     |
|--------------------|---------------------------------------------------|---------------------------------------------|
| `--eas`            | EAS contract address on target chain              | `0x4200000000000000000000000000000000000021` |
| `--fee`            | Fee in ETH (not wei)                              | `0.001`                                     |
| `--treasury`       | Address to receive fees (Gnosis Safe recommended) | `0x123...`                                  |
| `--confirmations`  | Block confirmations to wait (optional)            | `5`                                         |

The deployed address is saved to `contract-addresses.txt`.

### Step 2: Deploy Schemas with Resolver

```bash
# From rep-attestation-tools-evm-solidity/
npx hardhat deploy-eas-schema \
  --file generated/Endorsement.eas.json \
  --resolver <FEE_RESOLVER_ADDRESS> \
  --network <NETWORK>
```

The `--resolver` flag attaches the fee resolver to each schema.

### Step 3: Sanity Test

```bash
npx hardhat fee-resolver-sanity \
  --network <NETWORK> \
  --resolver <FEE_RESOLVER_ADDRESS> \
  --treasury <TREASURY_ADDRESS>
```

What the sanity test does:
1. Reads and verifies resolver configuration (fee, treasury, isPayable)
2. Registers a test schema with the resolver
3. Creates a test attestation with the required fee
4. Verifies the fee was forwarded to the treasury
5. Confirms the resolver has zero balance (no custody)

### Step 4: Verify on Explorer (optional)

```bash
npx hardhat verify --network <NETWORK> \
  <FEE_RESOLVER_ADDRESS> \
  "<EAS_ADDRESS>" "<FEE_IN_WEI>" "<TREASURY_ADDRESS>"
```

Note: Constructor args are: EAS address, fee in wei, treasury address.

### Fee Resolver Design Notes
- Immutable: Fee and treasury are set at deployment and cannot be changed
- No custody: Fees are forwarded immediately, resolver never holds funds
- Exact fee required: Users must send exactly the fee amount (no refunds)
- Gnosis Safe compatible: Uses `.call{}` for ETH transfer (no gas stipend limit)

---

## Deploy Task Reference

| Task                   | Description                                                                      |
|------------------------|----------------------------------------------------------------------------------|
| `deploy-system`        | Full system (Registry + Metadata + Resolver), links them, runs integration tests |
| `deploy-registry`      | Registry contract only                                                           |
| `deploy-metadata`      | Metadata contract only                                                           |
| `deploy-resolver`      | Resolver contract only                                                           |
| `deploy-timelock`      | OpenZeppelin TimelockController                                                  |
| `deploy-eas-system`    | EAS SchemaRegistry + EAS contract (OMAchain only)                                |
| `deploy-fee-resolver`  | OMATrustFeeResolver for external chains                                          |
| `eas-sanity`           | Verify EAS deployment works                                                      |
| `fee-resolver-sanity`  | Verify fee resolver deployment works                                             |
| `check-contracts`      | Check contract status and configuration                                          |
| `check-wallet-sync`    | Audit wallet addresses across all repos against approved-addresses.json          |
| `update-frontend-abis` | Copy compiled ABIs to frontend project                                           |

---

## Deployment Key Strategy

<!-- SYNC: Key file paths and loading logic also implemented in oma3-ops/src/admin-wallet/direct-call.ts (devnet fallback). Update both when changing key paths or format. -->

Deployment uses a one-time SSH key file. After deploying, ownership transfers to the TimelockController, and the deployment key has zero on-chain authority. It can be deleted after deployment.

### Key selection

`hardhat.config.ts` auto-selects the key file based on the `--network` flag:

1. `DEPLOYMENT_KEY_PATH` env var wins if set (explicit override)
2. Otherwise, network-specific default:
   - `--network omachainMainnet` → `~/.ssh/mainnet-evm-deployment-key`
   - All other networks → `~/.ssh/test-evm-deployment-key`
3. If the resolved file does not exist on a non-local network, hard error

| Environment | SSH Key File                        |
|-------------|-------------------------------------|
| Devnet      | `~/.ssh/test-evm-deployment-key`    |
| Testnet     | `~/.ssh/test-evm-deployment-key`    |
| Mainnet     | `~/.ssh/mainnet-evm-deployment-key` |

Each key file contains a raw 64-character hex private key (with or without `0x` prefix). Generate a new key for mainnet — do not reuse the testnet key.

To override the default key path:
```bash
export DEPLOYMENT_KEY_PATH=~/.ssh/custom-deployment-key
```

### How it works

1. Deploy tasks use the key via `getDeployerSigner()`
2. After deployment, transfer ownership to the timelock (Phase B Step 5)
3. The deployment key is now powerless — all admin goes through the timelock via the admin server wallet
4. Optionally delete the key file after deployment

### Why not server wallets for deployment?

Server wallets are for ongoing operations (attestations, admin via timelock). Deployment is a one-time event where the key immediately loses authority. Building a Thirdweb-compatible Hardhat signer adapter adds complexity for no security gain — the key is about to become useless anyway.

---

## Approved Addresses and Wallet Sync

Authorized wallet addresses (attestation wallets, admin wallets, on-chain issuers, controller witness attesters) are referenced in multiple repositories. The source of truth is `oma3-ops/approved-addresses.json` — a manually maintained JSON file that includes OMA3 wallets and any third-party attesters added via timelock proposals.

`contract-addresses.txt` tracks what's deployed (auto-generated by deploy tasks — contracts only). `approved-addresses.json` tracks who's authorized (maintained by humans). Both are inputs to the sync check.

When adding or removing an issuer:
1. Update `oma3-ops/approved-addresses.json`
2. Update `app-registry-frontend/src/config/controller-witness-config.ts`
3. Run `check-wallet-sync` to verify all downstream consumers match (see `oma3-ops/ISSUE-check-wallet-sync.md` for planned tooling)

### Checking wallet sync

> **Note:** The `check-wallet-sync` task is planned but not yet implemented. See `oma3-ops/ISSUE-check-wallet-sync.md` for the full spec. The manual process is described above.

```bash
npx hardhat check-wallet-sync \
  --network <NETWORK> \
  --workspace ../
```

| Parameter      | Description                                          | Default |
|----------------|------------------------------------------------------|---------|
| `--network`    | Target network to check                              | —       |
| `--workspace`  | Parent directory containing all OMA3 repos            | `../`   |
| `--fix`        | Auto-update config files to match approved-addresses  | `false` |

What the task will do:
1. Reads `oma3-ops/approved-addresses.json` and filters by environment and role
2. Reads `contract-addresses.txt` for deployed contract addresses
3. Scans config files across repos for wallet references:
   - `app-registry-frontend/src/config/controller-witness-config.ts` (role: `controller-witness`)
   - `app-registry-frontend/src/config/chains.ts`
   - `rep-attestation-frontend/src/config/chains.ts`
   - `rep-attestation-frontend/src/config/attestation-services.ts`
   - `oma3-ops/src/admin-wallet/config.ts` (role: `admin`)
4. Checks on-chain issuer status via `resolver.isIssuer()` (role: `issuer`)
5. Reports:
   - Addresses in config files but not in `approved-addresses.json` (stale)
   - Addresses in `approved-addresses.json` but missing from config files (not propagated)
   - Addresses not yet authorized on-chain (pending timelock execution)
   - Addresses that are in sync
