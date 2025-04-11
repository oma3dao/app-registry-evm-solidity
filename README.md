# OMA3 Application Registry Contracts- Solidity/EVM

This repository implements the Application Registry actor described in the Inter World Portaling System specification for identity.  

## License and Participation

- Code is licensed under [MIT](./LICENSE)
- Contributor terms are defined in [CONTRIBUTING.md](./CONTRIBUTING.md)

## Deployment and Interaction Guide

### Current Deployment

The OMA3AppRegistry contract is currently deployed on the Celo Alfajores testnet:
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83

### Contract ABI

The contract ABI is generated automatically when you compile the contracts and can be found at:

```
artifacts/contracts/OMA3AppRegistry.sol/OMA3AppRegistry.json
```

You can extract just the ABI portion for use in your frontend applications:

```bash
# Using jq (if installed)
jq .abi artifacts/contracts/OMA3AppRegistry.sol/OMA3AppRegistry.json > oma3app-registry-abi.json

# Or manually open the file and copy the "abi" array
```

### Testing the Contract

1. Change the MAX_APPS_PER_PAGE and MAX_DIDS_PER_PAGE to more testable numbers by changing the line comments appropriately

2. Compile
   ```bash
   npx hardhat compile
   ```

3. Run scripts
   ```bash
   npx hardhat test
   ```
4. Change the MAX_APPS_PER_PAGE and MAX_DIDS_PER_PAGE back to production values

5. Compile again
   ```bash
   npx hardhat compile
   ```

### Deploying the Contract

1. **Setup environment**:
   ```bash
   # Install dependencies
   npm install
   
   # Create a .env file with your private key or ensure it's in ~/.ssh/test-evm-deployment-key
   echo "PRIVATE_KEY=0xyourprivatekey" > .env
   ```

2. **Deploy to Celo Alfajores** (only necessary to deploy a new contract):
   ```bash
   npx hardhat run scripts/deploy.ts --network celoAlfajores
   ```

3. **Verify the contract** (optional):
   ```bash
   npx hardhat verify --network celoAlfajores <CONTRACT_ADDRESS>
   ```
4. Make note of the new contract address and update other projects accordingly

### Interacting with the Contract

#### Using Hardhat Tasks

```bash
# Register a new app
npx hardhat registerApp --name "My App" --registry <CONTRACT_ADDRESS> --network celoAlfajores

# Get app details
npx hardhat getApp --id <APP_ID> --registry <CONTRACT_ADDRESS> --network celoAlfajores
```
