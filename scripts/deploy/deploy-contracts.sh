#!/bin/bash

# OMA3 Contract Deployment Script
# Deploys published contracts using server wallet and returns deployed EVM addresses
# Usage: ./deploy-contracts.sh <environment> [--registry <id>] [--metadata <id>] [--resolver <id>]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Initialize contract IDs
REGISTRY_ID=""
METADATA_ID=""
RESOLVER_ID=""

# Parse arguments
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --registry)
            REGISTRY_ID="$2"
            shift 2
            ;;
        --metadata)
            METADATA_ID="$2"
            shift 2
            ;;
        --resolver)
            RESOLVER_ID="$2"
            shift 2
            ;;
        --help|-h)
            print_status "Usage: $0 <environment> [--registry <id>] [--metadata <id>] [--resolver <id>]"
            print_status "Examples:"
            print_status "  $0 testnet --registry QmbS26... --metadata QmPBEQ8... --resolver QmXyZ123..."
            print_status "  $0 mainnet --registry QmbS26... --metadata QmPBEQ8..."
            print_status "  $0 testnet --registry QmbS26..."
            print_status ""
            print_status "Contract IDs should be the IPFS hashes from npx thirdweb publish output"
            print_status "At least one contract must be specified"
            exit 0
            ;;
        *)
            if [ -z "$ENVIRONMENT" ]; then
                ENVIRONMENT="$1"
            else
                print_error "Unknown argument: $1"
                print_error "Use --help for usage information"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate environment
if [ -z "$ENVIRONMENT" ]; then
    print_error "Environment is required"
    print_error "Usage: $0 <environment> [--registry <id>] [--metadata <id>] [--resolver <id>]"
    exit 1
fi

# Validate at least one contract is specified
if [ -z "$REGISTRY_ID" ] && [ -z "$METADATA_ID" ] && [ -z "$RESOLVER_ID" ]; then
    print_error "At least one contract must be specified"
    print_error "Use --registry, --metadata, and/or --resolver flags"
    exit 1
fi

WALLET_IDENTIFIER="oma3-${ENVIRONMENT}-1"

print_header "Deploying contracts for environment: $ENVIRONMENT"
print_status "Looking for wallet: $WALLET_IDENTIFIER"

# Get secret key (check environment variable first, then prompt)
if [ -z "$THIRDWEB_SECRET_KEY" ]; then
    echo -n "Enter your Bitwarden secret key: "
    read -s SECRET_KEY
    echo ""
else
    SECRET_KEY="$THIRDWEB_SECRET_KEY"
    print_status "Using secret key from environment variable"
fi

if [ -z "$SECRET_KEY" ]; then
    print_error "Secret key cannot be empty"
    exit 1
fi

# Check if wallet exists by listing all server wallets
print_status "Checking for server wallet..."

# Make API call to list server wallets
WALLET_RESPONSE=$(curl -s -X GET "https://api.thirdweb.com/v1/wallets/server" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "Content-Type: application/json")

# Check if request was successful
if echo "$WALLET_RESPONSE" | grep -q '"error"'; then
    print_error "Failed to list server wallets:"
    echo "$WALLET_RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
    exit 1
fi

# Extract wallet information
WALLET_LIST=$(echo "$WALLET_RESPONSE" | jq -r '.result.wallets[] | "identifier: \(.profiles[].identifier), address: \(.address)"' 2>/dev/null || echo "")

# Look for our wallet identifier in the list
if ! echo "$WALLET_LIST" | grep -q "identifier: $WALLET_IDENTIFIER"; then
    print_error "Wallet $WALLET_IDENTIFIER not found"
    print_error "Run: ./scripts/deploy/create-server-wallet.sh $ENVIRONMENT"
    exit 1
fi

# Extract wallet address
WALLET_ID=$(echo "$WALLET_RESPONSE" | jq -r ".result.wallets[] | select(.profiles[].identifier == \"$WALLET_IDENTIFIER\") | .address" 2>/dev/null)

print_status "Using wallet: $WALLET_ID ($WALLET_IDENTIFIER)"

print_status "Contracts to deploy:"
if [ -n "$REGISTRY_ID" ]; then
    print_status "  Registry: $REGISTRY_ID"
fi
if [ -n "$METADATA_ID" ]; then
    print_status "  Metadata: $METADATA_ID"
fi
if [ -n "$RESOLVER_ID" ]; then
    print_status "  Resolver: $RESOLVER_ID"
fi

# Create temporary file for deployed addresses
DEPLOYED_ADDRESSES_FILE=".deployed-addresses.tmp"

# Function to deploy a single contract
deploy_contract() {
    local published_id="$1"
    local contract_name="$2"

    print_status "Deploying $contract_name..."

    # Deploy contract
    RESPONSE=$(curl -s -X POST "https://api.thirdweb.com/v1/contracts/deploy" \
      -H "x-secret-key: $SECRET_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"walletId\": \"$WALLET_ID\",
        \"contractAddress\": \"$published_id\",
        \"constructorParams\": []
      }")

    # Debug: Show raw response for troubleshooting
    print_status "Debug: Raw API response for $contract_name:"
    echo "$RESPONSE" | head -10

    # Check if request was successful
    if echo "$RESPONSE" | grep -q '"error"'; then
        print_error "Failed to deploy $contract_name:"
        echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
        return 1
    fi

    # Extract deployed contract address
    DEPLOYED_ADDRESS=$(echo "$RESPONSE" | grep -o '"address":"[^"]*"' | head -1 | sed 's/"address":"//;s/"//')

    if [ -z "$DEPLOYED_ADDRESS" ]; then
        print_error "Failed to extract deployed address for $contract_name"
        print_error "Response did not contain expected 'address' field"
        return 1
    fi

    print_status "Deployed $contract_name: $DEPLOYED_ADDRESS"

    # Store the deployed address
    echo "DEPLOYED_${contract_name^^}_ADDRESS=$DEPLOYED_ADDRESS" >> "$DEPLOYED_ADDRESSES_FILE"

    return 0
}

# Deploy each contract
print_header "Deploying contracts to blockchain..."

FAILED_CONTRACTS=()

# Deploy Registry (if specified)
if [ -n "$REGISTRY_ID" ]; then
    if ! deploy_contract "$REGISTRY_ID" "OMA3AppRegistry"; then
        FAILED_CONTRACTS+=("OMA3AppRegistry")
    fi
fi

# Deploy Metadata (if specified)
if [ -n "$METADATA_ID" ]; then
    if ! deploy_contract "$METADATA_ID" "OMA3AppMetadata"; then
        FAILED_CONTRACTS+=("OMA3AppMetadata")
    fi
fi

# Deploy Resolver (if specified)
if [ -n "$RESOLVER_ID" ]; then
    if ! deploy_contract "$RESOLVER_ID" "OMA3ResolverWithStore"; then
        FAILED_CONTRACTS+=("OMA3ResolverWithStore")
    fi
fi

# Check if any contracts failed
if [ ${#FAILED_CONTRACTS[@]} -ne 0 ]; then
    print_error "Failed to deploy contracts: ${FAILED_CONTRACTS[*]}"
    rm -f "$DEPLOYED_ADDRESSES_FILE"
    exit 1
fi

print_status "All contracts deployed successfully!"

# Display deployed addresses
print_header "Deployed Contract Addresses:"
cat "$DEPLOYED_ADDRESSES_FILE"

# Save to permanent file (repository root)
CONTRACT_ADDRESSES_FILE="contract-addresses.txt"

# Determine deployment type
DEPLOYMENT_TYPE="Full System Deployment"
if [ -n "$REGISTRY_ID" ] && [ -z "$METADATA_ID" ] && [ -z "$RESOLVER_ID" ]; then
    DEPLOYMENT_TYPE="Individual Contract (Registry)"
elif [ -z "$REGISTRY_ID" ] && [ -n "$METADATA_ID" ] && [ -z "$RESOLVER_ID" ]; then
    DEPLOYMENT_TYPE="Individual Contract (Metadata)"
elif [ -z "$REGISTRY_ID" ] && [ -z "$METADATA_ID" ] && [ -n "$RESOLVER_ID" ]; then
    DEPLOYMENT_TYPE="Individual Contract (Resolver)"
fi

# Extract network ID
NETWORK_ID=$(grep -o '"network":[0-9]*' <<< "$RESPONSE" | grep -o '[0-9]*' | head -1 || echo "unknown")

# Count existing deployments to get next number
DEPLOYMENT_COUNT=$(grep -c "^=== Deployment #" "$CONTRACT_ADDRESSES_FILE" 2>/dev/null || echo "0")
DEPLOYMENT_NUMBER=$((DEPLOYMENT_COUNT + 1))

# Add deployment record
{
    echo ""
    echo "=== Deployment #${DEPLOYMENT_NUMBER} ==="
    echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "Network: ${ENVIRONMENT} (Chain ID: ${NETWORK_ID})"
    echo "Type: ${DEPLOYMENT_TYPE}"
    echo "Method: Thirdweb (Server Wallet)"
    echo "Deployer: $WALLET_ID"
    echo "Status: ACTIVE"
    echo ""
    echo "Deployed Contracts:"
    
    # Parse and format deployed addresses
    while IFS='=' read -r key value; do
        if [[ $key == DEPLOYED_* ]]; then
            # Convert DEPLOYED_OMA3APPREGISTRY_ADDRESS to Registry
            CONTRACT_NAME=$(echo "$key" | sed 's/DEPLOYED_//;s/_ADDRESS//;s/OMA3APPREGISTRY/Registry/;s/OMA3APPMETADATA/Metadata/;s/OMA3RESOLVERWITHSTORE/Resolver/')
            printf "  %-10s %s\n" "${CONTRACT_NAME}:" "$value"
        fi
    done < "$DEPLOYED_ADDRESSES_FILE"
    
    echo ""
    echo "Deployment Details:"
    echo "  Block Confirmations: N/A (Thirdweb managed)"
    echo "  Verification Status: Pending (run verify commands if supported by explorer)"
    echo "============================================================================"
} >> "$CONTRACT_ADDRESSES_FILE"

# Note: Summary update is handled by TypeScript deployment logger for Hardhat deployments
# For Thirdweb deployments, we manually update if needed
print_status "TODO: Manually update Active Deployments summary in contract-addresses.txt if this is the latest deployment"

# Clean up temporary file
rm -f "$DEPLOYED_ADDRESSES_FILE"

print_status "Deployed addresses saved to: $CONTRACT_ADDRESSES_FILE"
print_status ""
print_status "Next steps:"
print_status "1. Verify contract deployments on blockchain explorer"
print_status "2. Run: ./scripts/deploy/configure-contracts.sh $ENVIRONMENT"
print_status "3. Test contract interactions"
