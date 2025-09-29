# **OMA3 Thirdweb Deployment Scripts**

This directory contains shell scripts for deploying OMA3 smart contracts using Thirdweb server wallets.

## ⚠️ **Important: Run from Project Root**

**All deployment scripts must be run from the `app-registry-evm-solidity` project root directory**, not from the `scripts/deploy/` folder. The scripts expect to find `artifacts/contracts/` relative to the project root.

```bash
# ✅ Correct - from project root
cd /path/to/app-registry-evm-solidity
./scripts/deploy/publish-contracts.sh OMA3AppRegistry

# ❌ Wrong - from scripts/deploy folder
cd /path/to/app-registry-evm-solidity/scripts/deploy
./publish-contracts.sh OMA3AppRegistry  # Will fail to find artifacts
```

## **Security Notice**

⚠️ **Critical**: These scripts handle sensitive operations and API credentials. Never commit:
- Any files with `.tmp` extension (temporary files)
- Credentials or private keys

**Note**: Contract and wallet addresses are public information and should be documented in the main README after deployment.

## **Technical Implementation**

This folder contains the technical implementation of the Thirdweb deployment system. For user-friendly deployment instructions, see the main README.md.

### Prerequisites (Technical)

**Required Before Deployment:**

1. **Thirdweb Project Setup**:
   - Thirdweb project configured with API credentials
   - API secret key available in Bitwarden

2. **Network Access**: Target blockchain networks accessible

**Verification**:
- Check `contracts/` directory contains up-to-date source files
- Thirdweb CLI will automatically compile contracts during publish

### Credential Management

**Required**: Thirdweb API Secret Key (from your Thirdweb project dashboard) stored in Bitwarden or other secrets manager

**Rotating Your Secret Key**:
1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Select your project
3. Navigate to Overview and clock "Rotate Secret Key"
4. Copy the **Secret Key** (not the Client ID)
5. Store securely in Bitwarden or similar password manager

Secret keys should be rotated on a regular basis to prevent supply chain attacks.

### Workflow Integration
The scripts work together to provide a complete deployment pipeline:

**Complete Deployment Process:**
1. **Create server wallet** → `create-server-wallet.sh` (creates/reuses wallet)
2. **Upload contracts** → `publish-contracts.sh` (compiles & uploads to Thirdweb, returns publish URL)
3. **Publish contracts** → **Manual step via dashboard** (visit URL, publish each contract)
4. **Deploy contracts** → **Choose Option A (Dashboard) or Option B (Script)**
5. **Configure contracts** → `configure-contracts.sh` (links deployed contracts)

**Recommended Workflow (Dashboard Deployment):**
```bash
# Navigate to project root first
cd /path/to/app-registry-evm-solidity

# 1. Create/reuse server wallet
./scripts/deploy/create-server-wallet.sh production

# 2. Upload contracts to Thirdweb (auto-compiles)
./scripts/deploy/publish-contracts.sh

# 3. Complete publishing via dashboard (manual)
# - Visit the URL from step 2 output
# - Click "Publish" for each contract
# - Deploy each contract using your server wallet

# 4. Configure deployed contracts
./scripts/deploy/configure-contracts.sh production
```

### NPM Script Available
For wallet management:
```bash
# List all server wallets
npm run deploy:list-wallets
```

**Note**: Deployment is primarily done via individual scripts and manual dashboard steps rather than NPM pipeline automation.

## **Script Reference**

### 1. create-server-wallet.sh

**Purpose**: Creates or reuses a server wallet for the specified environment.

**Arguments**:
- `<environment>` - Environment name (e.g., `production`, `testnet`, `development`)

**Behavior**:
- Lists all server wallets via Thirdweb API
- Checks if wallet `oma3-{environment}-1` already exists
- Uses existing wallet if found (no creation needed)
- Creates new wallet `oma3-{environment}-1` if not found
- Auto-verifies wallet creation

**Usage Examples**:
```bash
# From project root directory
cd /path/to/app-registry-evm-solidity

# Create/use wallet for production (oma3-production-1)
./scripts/deploy/create-server-wallet.sh production

# Create/use wallet for testnet (oma3-testnet-1)
./scripts/deploy/create-server-wallet.sh testnet
```

**Interactive Prompts**:
- Prompts for Bitwarden secret key (secure password input) if `THIRDWEB_SECRET_KEY` environment variable is not set
- **How to get the key**: See "Credential Management" section above
- **Input method**: Paste or type the secret key when prompted
- **Security**: Input is hidden (password-style)
- **Environment variable**: Set `THIRDWEB_SECRET_KEY=your_key` to avoid prompts

**NPM Script Usage**:
```bash
# Production deployment pipeline
npm run deploy:prod:wallet
npm run deploy:prod:publish
npm run deploy:prod:contracts
npm run deploy:prod:configure

# Testnet deployment pipeline
npm run deploy:test:wallet
npm run deploy:test:publish
npm run deploy:test:contracts
npm run deploy:test:configure
```

**Outputs**:
- **Console**: Wallet address, identifier, environment, and verification status
- **File**: `wallet-addresses.txt` - Server wallet information
- **Auto-verification**: Automatically calls `list-server-wallets.sh` to confirm creation
- **Format**:
  ```
  === Server Wallet Information ===
  Created: 2024-01-15T10:30:00Z
  Environment: production
  Wallet ID: oma3-production-1
  Wallet Address: 0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
  ```

**Exit Codes**:
- `0`: Success
- `1`: Error (invalid arguments, API failure, etc.)

### 2. publish-contracts.sh (Script) or Manual Publishing

**Purpose**: Uploads compiled contract artifacts to Thirdweb and returns publish URLs.

#### Option A: Automated Script
```bash
# From project root directory
cd /path/to/app-registry-evm-solidity
./scripts/deploy/publish-contracts.sh
```

#### Option B: Manual Publishing (Shell-Specific)

**Bash (Linux, WSL, macOS bash):**
```bash
cd /path/to/app-registry-evm-solidity
read -s -p "Secret key: " KEY && echo && npx thirdweb publish -k "$KEY"
```

**Zsh (macOS default):**
```bash
cd /path/to/app-registry-evm-solidity
echo -n "Secret key: " && read -s KEY && echo && npx thirdweb publish -k "$KEY"
```

**Fish Shell:**
```bash
cd /path/to/app-registry-evm-solidity
read -s -P "Secret key: " KEY; and npx thirdweb publish -k "$KEY"
```

**PowerShell (Windows):**
```powershell
cd C:\path\to\app-registry-evm-solidity
$KEY = Read-Host "Secret key" -AsSecureString; npx thirdweb publish -k ([Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEY)))
```

**Manual Process**: Enter secret key → Select contracts with space → Press Enter to publish

**Two-Step Process**:
1. **Script uploads contracts** → Returns publish URL with all 6 contracts
2. **Manual dashboard action** → Visit URL, publish each contract individually to your profile

**Prerequisites**:
- Contract source files must exist in `contracts/` directory
- Thirdweb CLI automatically compiles contracts during publish

**Interactive Prompts**:
- Prompts for Bitwarden secret key (secure password input) if `THIRDWEB_SECRET_KEY` environment variable is not set
- **How to get the key**: See "Credential Management" section above
- **Input method**: Paste or type the secret key when prompted
- **Security**: Input is hidden (password-style)
- **Environment variable**: Set `THIRDWEB_SECRET_KEY=your_key` to avoid prompts
- Validates contract files exist in `artifacts/contracts/`

**Direct Script Usage** (Recommended):
```bash
# Run directly from project root
./scripts/deploy/publish-contracts.sh
```

**Outputs**:
- **Console**: Single publish URL containing all 6 contracts
- **File**: `contract-addresses.txt` - Publish URL for manual completion
- **Format**:
  ```
  === Contract Publishing Information ===
  Published: 2024-01-15T10:35:00Z
  PUBLISHED_ALL_CONTRACTS_URL=https://thirdweb.com/contracts/publish?ipfs=QmWc5...
  ```

**Exit Codes**:
- `0`: Success
- `1`: Error (missing contracts, API failure, compilation issues)

### 3. Contract Deployment Options

After publishing contracts, you have **two deployment options**:

#### **Option A: Thirdweb Dashboard (Recommended for Production)**

**Advantages**:
- ✅ **Visual interface** - Review parameters before deployment
- ✅ **Server wallet integration** - Select `oma3-{environment}-1` from dropdown
- ✅ **Network flexibility** - Choose any supported network
- ✅ **Manual verification** - Confirm each deployment step

**Process**:
1. Visit the publish URL from `publish-contracts.sh` output
2. Click "Publish" for each contract to add to your profile
3. Navigate to each published contract page
4. Click "Deploy Now"
5. Select your server wallet (`oma3-{environment}-1`)
6. Choose target network and configure parameters
7. Deploy

#### **Option B: deploy-contracts.sh Script (Automated)**

**Purpose**: Deploys published contracts to blockchain using server wallet via API.

**Arguments**:
- `<environment>` - Environment name (must match wallet creation)

**Behavior**:
- Lists all server wallets via Thirdweb API
- Automatically finds wallet `oma3-{environment}-1`
- Fails if wallet doesn't exist (run create-server-wallet.sh first)
- **Note**: Requires individual published contract IDs (not currently supported by publish workflow)

**Usage Examples**:
```bash
# From project root directory
cd /path/to/app-registry-evm-solidity

# Deploy to production (uses oma3-production-1)
./scripts/deploy/deploy-contracts.sh production

# Deploy to testnet (uses oma3-testnet-1)
./scripts/deploy/deploy-contracts.sh testnet
```

**Interactive Prompts**:
- Prompts for Bitwarden secret key (secure password input) if `THIRDWEB_SECRET_KEY` environment variable is not set
- **How to get the key**: See "Credential Management" section above
- **Input method**: Paste or type the secret key when prompted
- **Security**: Input is hidden (password-style)
- **Environment variable**: Set `THIRDWEB_SECRET_KEY=your_key` to avoid prompts
- Requires prior execution of `publish-contracts.sh`

**NPM Script Usage**:
```bash
# Production deployment (uses wallet from previous creation step)
npm run deploy:prod:contracts

# Testnet deployment (uses wallet from previous creation step)
npm run deploy:test:contracts
```

**Outputs**:
- **Console**: Deployed contract addresses for each contract
- **File**: `contract-addresses.txt` - Deployed contract addresses
- **Format**:
  ```
  === Contract Deployment Information ===
  Deployed: 2024-01-15T10:40:00Z
  Environment: production
  Wallet ID: oma3-production-1
  Network: 42220
  DEPLOYED_OMA3APPREGISTRY_ADDRESS=0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
  DEPLOYED_OMA3APPMETADATA_ADDRESS=0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9
  DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS=0x24B0B17adb13DB2146995480e0114b2c93Df217f
  ```

**Exit Codes**:
- `0`: Success
- `1`: Error (missing published IDs, wallet issues, deployment failure)

### 4. configure-contracts.sh

**Purpose**: Links deployed contracts and configures resolver policies.

**Arguments**:
- `<environment>` - Environment name (must match deployment)

**Behavior**:
- Lists all server wallets via Thirdweb API
- Automatically finds wallet `oma3-{environment}-1`
- Fails if wallet doesn't exist (run create-server-wallet.sh first)

**Usage Examples**:
```bash
# From project root directory
cd /path/to/app-registry-evm-solidity

# Configure production contracts
./scripts/deploy/configure-contracts.sh production

# Configure testnet contracts
./scripts/deploy/configure-contracts.sh testnet
```

**Interactive Prompts**:
- Prompts for Bitwarden secret key (secure password input) if `THIRDWEB_SECRET_KEY` environment variable is not set
- **How to get the key**: See "Credential Management" section above
- **Input method**: Paste or type the secret key when prompted
- **Security**: Input is hidden (password-style)
- **Environment variable**: Set `THIRDWEB_SECRET_KEY=your_key` to avoid prompts
- Requires prior execution of `deploy-contracts.sh`

**NPM Script Usage**:
```bash
# Production configuration
npm run deploy:prod:configure

# Testnet configuration
npm run deploy:test:configure
```

**Outputs**:
- **Console**: Transaction hashes for each configuration step
- **File**: `contract-addresses.txt` - Configuration information
- **Format**:
  ```
  === Contract Configuration Information ===
  Configured: 2024-01-15T10:45:00Z
  Environment: production

  Contract Relationships:
    Registry (0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5) → Metadata (0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9)
    Metadata (0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9) → Registry (0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5)
    Registry (0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5) → Ownership Resolver (0x24B0B17adb13DB2146995480e0114b2c93Df217f)
    Registry (0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5) → Data URL Resolver (0x24B0B17adb13DB2146995480e0114b2c93Df217f)
  ```

**Exit Codes**:
- `0`: Success
- `1`: Error (missing deployed addresses, configuration failure)

### 5. list-server-wallets.sh

**Purpose**: Lists all server wallets in the Thirdweb project.

**Arguments**: None (uses project-wide configuration)

**Usage Examples**:
```bash
# List all server wallets
./list-server-wallets.sh

# Using NPM script
npm run deploy:list-wallets
```

**Interactive Prompts**:
- Prompts for Bitwarden secret key (secure password input) if `THIRDWEB_SECRET_KEY` environment variable is not set
- **How to get the key**: See "Credential Management" section above
- **Input method**: Paste or type the secret key when prompted
- **Security**: Input is hidden (password-style)
- **Environment variable**: Set `THIRDWEB_SECRET_KEY=your_key` to avoid prompts

**Outputs**:
- **Console**: Formatted list of all server wallets with details
- **File**: `wallet-addresses.txt` - Updated with current wallet listing
- **Format**:
  ```
  --- WALLET ---
  - address: 0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
  - identifier: oma3-production-1
  - createdAt: 2024-01-15T10:30:00Z
  - smartWalletAddress:
  ```

**Exit Codes**:
- `0`: Success (even if no wallets found)
- `1`: Error (API failure, authentication issues)

## **Address Management
**
### File Structure
- `contract-addresses.txt` - Published IDs and deployed addresses (for script reference)
- `.tmp` files - Temporary processing files (auto-cleaned)

### Production Documentation
After successful deployment, update the main README.md with the deployed contract addresses:

```bash
# Example of what to add to README.md
#### Current Deployment (Celo Alfajores Testnet)
- **OMA3AppRegistry**: 0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
- **OMA3AppMetadata**: 0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9
- **OMA3ResolverWithStore**: 0x24B0B17adb13DB2146995480e0114b2c93Df217f

# Wallet addresses are shown in console output or can be listed with:
./scripts/deploy/list-server-wallets.sh
```

## **Technical Implementation**

### Script Architecture
- **Secure by design**: Credentials prompted, never stored in files
- **Modular workflow**: Each script handles one deployment phase
- **Error recovery**: Comprehensive validation and failure handling
- **Address coordination**: Scripts pass data between phases automatically

### Integration with Main README
- Deployment addresses should be documented in the main project README
- This technical documentation focuses on script mechanics
- For user-facing deployment guide, see main README.md

## **Security Best Practices**

1. **Credentials**: Only in Bitwarden, never in environment variables
2. **Script Execution**: Run scripts from project directory
3. **File Permissions**: Temporary files are gitignored
4. **Verification**: Always verify transactions on blockchain explorer
5. **Backup**: Keep deployment records for audit purposes

## **Troubleshooting**

### Common Issues

**"Contract file not found"**
- Run `npm run compile` first to generate contract artifacts
- Check `artifacts/contracts/` directory exists and contains JSON files
- Verify contract names match exactly (case-sensitive)
- Ensure contracts compile without errors

**"Failed to extract published ID"**
- Verify contract compilation succeeded
- Check Thirdweb API access and credentials
- Ensure contract artifacts are valid JSON

**"Secret key cannot be empty"**
- Ensure Bitwarden credentials are correct
- Check script has read access to terminal for password input

**"Wallet not found"**
- Verify wallet was created successfully (check creation response)
- Check wallet identifier matches exactly
- Confirm environment name is consistent
- **Timing issue**: Newly created wallets may take a moment to appear in list API
- **Authentication issue**: Ensure same secret key is used for both create and list operations

**"Deployment failed"**
- Check wallet has sufficient funds
- Verify network connectivity
- Review transaction on blockchain explorer

### Getting Help

1. Check script error messages for specific failure details
2. Verify Thirdweb dashboard for wallet/contract status
3. Check blockchain explorer for transaction confirmation
4. Review deployment logs in `contract-addresses.txt`
5. Check temporary files (`.tmp`) for debugging information

## **Summary**

This deployment system provides a secure, auditable way to deploy OMA3 contracts using Thirdweb's HSM-backed server wallets. The modular design ensures each deployment phase is handled correctly while maintaining security best practices throughout the process.

# **Development Contract Deployment**

## **For Development/Testing ONLY**

Use the Hardhat tasks for local development and testing:

1. **Setup environment**:
   ```bash
   # Install dependencies
   npm install
   
   # Create private key file for development
   mkdir -p ~/.ssh
   echo "PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" > ~/.ssh/test-evm-deployment-key
   chmod 600 ~/.ssh/test-evm-deployment-key
   ```

2. **Deploy to testnet for development**:

   ```bash
   # Deploy both Registry and Metadata contracts with linking
   npm run deploy:system -- --network celoAlfajores
   
   # Or deploy just the Registry contract
   npm run deploy:registry -- --network celoAlfajores
   ```

3. **Verify contracts on explorer** (optional):
   ```bash
   # Set API key 
   export CELOSCAN_API_KEY=your_api_key_here

   # Verify contracts using addresses from deployment output
   npx hardhat verify --network celoAlfajores <REGISTRY_ADDRESS>
   npx hardhat verify --network celoAlfajores <METADATA_ADDRESS>
   ```

## Deployment with Factory Contract (deprecated)

Use the `OMA3SystemFactory` contract for deployment:

1. **Prepare deployment**:
   ```bash
   npm run prepare:factory
   ```

2. **Deploy via Thirdweb Dashboard**:
   - Upload `artifacts/contracts/OMA3SystemFactory.sol/OMA3SystemFactory.json`
   - Deploy the factory (no constructor parameters needed)
   - Call `deploySystem(0)` to deploy both contracts with linking
   - Note the registry and metadata addresses from the deployment event

**Factory Benefits**:
- ✅ **Atomic deployment** - Both contracts deployed and linked in one transaction
- ✅ **Deterministic addresses** - Predictable contract addresses  
- ✅ **No circular dependency** - Factory handles the linking automatically
- ✅ **Ownership transfer** - You become the owner of both contracts
- ✅ **Minimal audit surface** - Simple factory logic, focus audit on main contracts

