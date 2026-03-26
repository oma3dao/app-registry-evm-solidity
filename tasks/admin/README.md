# Admin Tasks

Read-only tasks for inspecting deployed OMA3 contracts. No ownership required.

## resolver-view-attestations

View attestations in the resolver contract. Useful for verifying DID ownership, debugging attestation state, and checking issuer authorization.

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

## Where Did the Other Tasks Go?

Setup tasks (add issuer, set resolver, transfer ownership, configure maturation, etc.) moved to `tasks/setup/`. These use the deployment key and are called during initial contract setup before ownership transfers to the TimelockController.

After ownership is transferred, ongoing admin operations (add/remove issuer, change config) go through the timelock via the `oma3-ops` admin scripts. See `oma3-ops/README.md` Part 2 for usage.

| Phase | Tasks | Location |
|-------|-------|----------|
| Deploy | Put contracts on chain | `tasks/deploy/` |
| Setup | Configure and link contracts, transfer ownership | `tasks/setup/` |
| Ongoing admin | Timelock proposals via server wallet | `oma3-ops/src/admin-wallet/` |
| Read-only inspection | View attestations, check state | `tasks/admin/` (here) |
