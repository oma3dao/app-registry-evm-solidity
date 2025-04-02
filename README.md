# OMA3 Application Registry Contracts- Solidity/EVM

This repository implements the Application Registry actor described in the Inter World Portaling System specification for identity.  

# Contributor Agreement

Participation in this repository is a form of participation in OMA3 working groups. 

- If a user is a member or affiliated with an OMA3 member, then such participation is subject to the OMA3 membership terms. 
- If a user is or is employed by an OMA3 participant subject to an OMA3 Participant Agreement, any activity is subject to the terms of that Participation Agreement.

For all other users, any participation in this repository is subject to the terms of OMA3 Participation Agreement set forth below and available for review [here](https://cdn.prod.website-files.com/62a88c8ec868deb8bcfa3353/646b9276323aa40616615e6f_OMA3%20Participant%20Agreement%20final%20230505.pdf). Individual users acting within the scope of their employment, or otherwise as an agent of a legal entity, act on behalf of their employer or other legal entity. Those individuals represent that they have the right and authority to bind their employer or other principal to the terms, and the bound entity represents and warrants that it has the right to grant the licenses described in the terms. This includes agreement to and compliance with OMA3's Intellectual Property policy, available here: https://www.oma3.org/intellectual-property-rights-policy.


OMA3 PARTICIPANT AGREEMENT 
This Participant Agreement (“Agreement”) captures an individual, or, when such individual is participating within the scope of their employment or as an agent of a legal entity, an entity (“Participant”)’s agreement to the terms associated with participation in one or several OMA3 (“OMA3”) working groups (each a “Working Group”). 

1. Background. Participant wishes to participate in OMA3 activities through observation or interaction in one or several Working Groups. This Agreement documents the express agreement by Participant to the governance model, policies, and intellectual property framework that apply to participation in OMA3 and its Working Groups. To be clear, attendance, observation or contributions by Participant in a Working Group all constitute participation, as covered by this Agreement. 

2. Governance. Participant agrees to adhere to all OMA3’s Organizational Documents (as defined in its [Articles of Association](https://www.oma3.org/articles-of-association), including its Intellectual Property Rights Policy (available https://www.oma3.org/intellectual-property-rightspolicy), and applicable Working Group policies set forth in [OMA3’s Organizational Regulations](https://www.oma3.org/organizational-regulations), code of competition/antitrust policy (available at https://www.oma3.org/competition-antitrust-policy) and any other reasonable policies generally applicable to OMA3 Working Group participants and communicated to Participant. 

3. Intellectual property. Participant acknowledges and agrees that OMA3’s Intellectual Property Rights Policy will apply to Participant’s activities and participation in any OMA3 activity as if Participant were an OMA3 member, with the exception of Section 5 (RAND Exclusions) which will not apply to Participant. 

4. Termination. Participant may cease to participate in a Working Group at any time, upon notice to OMA3. OMA3 may terminate a Participant’s participation rights under this Agreement at any time in its discretion. License rights that accrued prior to termination will survive, but no new rights will vest post-termination. 

5. Limited liability. No party will be liable to any other party for monetary damages under this Agreement. All materials are provided “AS IS,” without warranty or representation of any kind. 

6. Dispute resolution. This Agreement will be governed by the substantive laws of Switzerland. If unable to resolve a dispute amicably, the dispute resolution mechanisms described in OMA3’s Articles of Association will apply. This Agreement constitutes the entire agreement and understanding between OMA3 and each Participant with respect to its subject matter.


# Deployment and Interaction Guide

## Current Deployment

The OMA3AppRegistry contract is currently deployed on the Celo Alfajores testnet:
- **Network**: Celo Alfajores Testnet
- **Contract Address**: 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83

## Contract ABI

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

## Deploying the Contract

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

## Interacting with the Contract

### Using Hardhat Tasks

```bash
# Register a new app
npx hardhat registerApp --name "My App" --registry <CONTRACT_ADDRESS> --network celoAlfajores

# Get app details
npx hardhat getApp --id <APP_ID> --registry <CONTRACT_ADDRESS> --network celoAlfajores
```
