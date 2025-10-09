# **OMA3 Thirdweb Deployment Scripts**

This directory contains shell scripts for deploying OMA3 smart contracts using Thirdweb server wallets.

## ⚠️ **Important: Run from Project Root**

**All deployment scripts must be run from the `app-registry-evm-solidity` project root directory**, not from the `scripts/deploy/` folder.

## **Quick Start**

### Prerequisites
1. **Thirdweb Project Setup**: API credentials configured
2. **Secret Key**: Available in Bitwarden and should be pasted into the script prompt
3. **Network Access**: Target blockchain networks accessible

### Environment Arguments
All scripts that require an environment parameter accept one of:
- `testnet` - For testnet deployment (e.g. OMAChain Testnet)
- `mainnet` - For mainnet deployment (e.g. OMAChain mainnet)

### Complete Deployment Workflow
```bash
# 1. List existing server wallets (optional - check what's available)
./scripts/deploy/list-server-wallets.sh

# 2. Create/reuse server wallet
./scripts/deploy/create-server-wallet.sh <wallet-identifier>

# 3. Upload contracts to Thirdweb (manual - recommended)
npx thirdweb publish -k "$SECRET_KEY"
# Select all contracts with spacebar, then press Enter

# 4. Deploy via Thirdweb Dashboard (manual)
# Visit the URL from step 3, deploy each contract using your server wallet

# 5. Configure deployed contracts
./scripts/deploy/configure-contracts.sh <environment>
```

## **Detailed Deployment**

### 1. Get the server wallet

**Usage:**
```bash
./scripts/deploy/create-server-wallet.sh <wallet-identifier>
# Examples:
#   ./scripts/deploy/create-server-wallet.sh OMA3-production-1
#   ./scripts/deploy/create-server-wallet.sh oma3-testnet-1
```

1.1 Paste the Thirdweb Secret Key when prompted
1.2 Note the identifier and address of the server wallet outputted to console

**Behavior:**
- Lists all server wallets via Thirdweb API
- Checks if wallet with specified identifier already exists
- Creates a new one if not

**Outputs:**
- Console: Wallet identifier and address

### 2. Upload Contracts to Thirdweb

**Manual Process for Each Contract**: 
1. Pick one of the commands below that best matches your development environment and run it

**Shell-Specific Commands**:

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

2. Paste the Secret Key when prompted
3. Select the desired contracts to upload with spacebar (OMA3AppRegistry, OMA3AppMetadata, OMA3ResolverWithStore, etc.)
4. Press Enter to upload
5. Copy the Contract ID from the link outputted in the console.  The Contract ID is the value right after "https://thirdweb.com/contracts/publish/".  For example, if the link is "https://thirdweb.com/contracts/publish/QmbS26EdespoH63MwdhysRJMc6GvgbGSmRzjeEcXHr1d5g" then the Contract ID would be "QmbS26EdespoH63MwdhysRJMc6GvgbGSmRzjeEcXHr1d5g"
6. Copy the Contract ID into the apprpropriate Uploaded Contract IDs line below

**Uploaded Contract IDs**
App Registry: QmbS26EdespoH63MwdhysRJMc6GvgbGSmRzjeEcXHr1d5g
App Metadata: QmPBEQ8PWapHvQKbe2DJEneaXw8zxXern2EaWNvfqQCZ6d
Resolver:     QmXUyPy6Wh3G4VmdoWUDv4KAFPZMAYwCQ9uwXjLEN8Xsev

**Behavior:**
- User has full control over which contracts to upload
- Thirdweb CLI automatically compiles contracts during publish

**Outputs:**
- Console: URL for continuing the publish process in the Thirdweb dashboard

### 3. Deploy Contracts

After publishing contracts and obtaining the Contract IDs, execute this command:

```bash
./scripts/deploy/deploy-contracts.sh <environment> [--registry <id>] [--metadata <id>] [--resolver <id>]
# <environment> must be: testnet or mainnet
# Contract IDs are the IPFS hashes from npx thirdweb publish output
# At least one contract must be specified
```

**Examples:**
```bash
# Deploy all three contracts
./scripts/deploy/deploy-contracts.sh testnet --registry QmbS26... --metadata QmPBEQ8... --resolver QmXyZ123...

# Deploy only registry and metadata
./scripts/deploy/deploy-contracts.sh testnet --registry QmbS26... --metadata QmPBEQ8...

# Deploy only registry
./scripts/deploy/deploy-contracts.sh testnet --registry QmbS26...
```

**Note**: Uses server wallet for deployment (not personal wallet like dashboard)

### 4. configure-contracts.sh
Links deployed contracts and configures resolver policies.

**Usage:**
```bash
./scripts/deploy/configure-contracts.sh <environment> --registry <address> --metadata <address> --resolver <address>
# <environment> must be: testnet or mainnet
# Contract addresses should be the deployed addresses from deploy-contracts.sh
# All three contracts are required for complete system configuration
```

**Examples:**
```bash
# Configure complete system (all three contracts required)
./scripts/deploy/configure-contracts.sh testnet --registry 0x742d35... --metadata 0x9f1f55... --resolver 0x24B0B17...

# Flags can be in any order
./scripts/deploy/configure-contracts.sh mainnet --resolver 0x24B0B17... --registry 0x742d35... --metadata 0x9f1f55...
```

**Behavior:**
- Automatically finds wallet `oma3-<environment>-1`
- Links deployed contracts together
- Configures resolver policies

**Outputs:**
- Console: Transaction hashes for each configuration step
- File: `contract-addresses.txt` - Configuration information

### 5. list-server-wallets.sh
Lists all server wallets in the Thirdweb project.

**Usage:**
```bash
./scripts/deploy/list-server-wallets.sh
```

**Outputs:**
- Console: Raw JSON response followed by formatted list of all server wallets

## **Credential Management**

**Required**: Thirdweb API Secret Key (from your Thirdweb project dashboard)

**Getting Your Secret Key**:
1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. Select your project
3. Navigate to Overview and click "Rotate Secret Key"
4. Copy the **Secret Key** (not the Client ID)
5. Store securely in Bitwarden or similar password manager

**Using the Secret Key**:
- Set `THIRDWEB_SECRET_KEY=your_key` environment variable to avoid prompts
- Or enter when prompted (input is hidden for security)

## **Address Management**

### File Structure
- `contract-addresses.txt` - **Deployment history and current active deployments**
- `.tmp` files - Temporary processing files (auto-cleaned)

### Contract Addresses File Format
The `contract-addresses.txt` file maintains a complete deployment history:

```bash
# OMA3 Contract Deployment History
# Generated: 2024-10-04T10:30:00Z

## Current Active Deployments

### Testnet (Latest)
  Deployed: 2024-10-04T10:30:00Z
  Environment: testnet
  Wallet ID: 0x7F16C09c3FDA956dD0CC3E21820E691EdD44B319
  Network: 66238
  DEPLOYED_OMA3APPREGISTRY_ADDRESS=0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
  DEPLOYED_OMA3APPMETADATA_ADDRESS=0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9

### Mainnet (Latest)
  Deployed: 2024-10-04T11:45:00Z
  Environment: mainnet
  Wallet ID: 0x8F27D10d4FDA956dD0CC3E21820E691EdD44B320
  Network: 12345
  DEPLOYED_OMA3APPREGISTRY_ADDRESS=0x842d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B6

## Full Deployment History
[Complete chronological deployment records...]
```

**Benefits:**
- ✅ **Current deployments** - Easy to see latest for each environment
- ✅ **Complete history** - Full audit trail of all deployments
- ✅ **Environment separation** - Clear testnet vs mainnet records
- ✅ **Append-only** - Never loses previous deployment data

### Production Documentation
After successful deployment, update the main README.md with the deployed contract addresses:

```bash
# Example of what to add to README.md
#### Current Deployment (Celo Alfajores Testnet)
- **OMA3AppRegistry**: 0x742d35Cc6634C0532925a3b8D0C7E7f5C5B5B5B5
- **OMA3AppMetadata**: 0x9f1f5559b6D08eC855cafaCD76D9ae69c41169C9
- **OMA3ResolverWithStore**: 0x24B0B17adb13DB2146995480e0114b2c93Df217f
```

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

**"Secret key cannot be empty"**
- Ensure Bitwarden credentials are correct
- Check script has read access to terminal for password input

**"Wallet not found"**
- Verify wallet was created successfully
- Check wallet identifier matches exactly
- Confirm environment name is consistent
- **Timing issue**: Newly created wallets may take a moment to appear in list API

**"Deployment failed"**
- Check wallet has sufficient funds
- Verify network connectivity
- Review transaction on blockchain explorer

### Getting Help

1. Check script error messages for specific failure details
2. Verify Thirdweb dashboard for wallet/contract status
3. Check blockchain explorer for transaction confirmation
4. Review deployment logs in `contract-addresses.txt`

## **Summary**

This deployment system provides a secure, auditable way to deploy OMA3 contracts using Thirdweb's HSM-backed server wallets. The modular design ensures each deployment phase is handled correctly while maintaining security best practices throughout the process.

---

## **Development Deployment**

For development and testing deployments using Hardhat tasks, see the [main README.md](../../README.md#development-deployment) in the project root.