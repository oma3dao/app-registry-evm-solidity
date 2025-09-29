#!/bin/bash

# OMA3 Contract Deployment Script
# Deploys published contracts using server wallet and returns deployed EVM addresses
# Usage: ./deploy-contracts.sh <environment> <wallet-id>

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

# Check arguments
if [ $# -ne 1 ]; then
    print_error "Usage: $0 <environment>"
    print_error "Examples:"
    print_error "  $0 production  # Uses oma3-production-1"
    print_error "  $0 testnet     # Uses oma3-testnet-1"
    exit 1
fi

ENVIRONMENT=$1
WALLET_IDENTIFIER="oma3-${ENVIRONMENT}-1"

print_header "Deploying contracts for environment: $ENVIRONMENT"
print_status "Looking for wallet: $WALLET_IDENTIFIER"

# Check if wallet exists by listing all server wallets
WALLET_LIST=$(./list-server-wallets.sh 2>/dev/null | grep -A 10 "Server Wallets Found" | grep -E "(address|identifier):" | grep -v "^---" || true)

# Look for our wallet identifier in the list
if ! echo "$WALLET_LIST" | grep -q "identifier: $WALLET_IDENTIFIER"; then
    print_error "Wallet $WALLET_IDENTIFIER not found"
    print_error "Run: ./create-server-wallet.sh $ENVIRONMENT"
    exit 1
fi

# Extract wallet address
WALLET_ID=$(echo "$WALLET_LIST" | grep -A 1 "identifier: $WALLET_IDENTIFIER" | grep "address:" | sed 's/address: //' | tr -d ' ')

print_status "Using wallet: $WALLET_ID ($WALLET_IDENTIFIER)"

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

# Check if contract addresses file exists
CONTRACT_ADDRESSES_FILE="scripts/deploy/contract-addresses.txt"
if [ ! -f "$CONTRACT_ADDRESSES_FILE" ]; then
    print_error "Contract addresses file not found: $CONTRACT_ADDRESSES_FILE"
    print_error "Make sure to run publish-contracts.sh first"
    exit 1
fi

# Source published IDs
source "$CONTRACT_ADDRESSES_FILE"

# Verify required published IDs exist
REQUIRED_IDS=("PUBLISHED_OMA3APPREGISTRY_ID" "PUBLISHED_OMA3APPMETADATA_ID" "PUBLISHED_OMA3RESOLVERWITHSTORE_ID")

for id_var in "${REQUIRED_IDS[@]}"; do
    if [ -z "${!id_var}" ]; then
        print_error "Required published ID not found: $id_var"
        print_error "Make sure all contracts were published successfully"
        exit 1
    fi
done

print_status "Found published contract IDs:"
print_status "  Registry: $PUBLISHED_OMA3APPREGISTRY_ID"
print_status "  Metadata: $PUBLISHED_OMA3APPMETADATA_ID"
print_status "  Resolver: $PUBLISHED_OMA3RESOLVERWITHSTORE_ID"

# Create temporary file for deployed addresses
DEPLOYED_ADDRESSES_FILE="scripts/deploy/.deployed-addresses.tmp"

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

# Deploy Registry
if ! deploy_contract "$PUBLISHED_OMA3APPREGISTRY_ID" "OMA3AppRegistry"; then
    FAILED_CONTRACTS+=("OMA3AppRegistry")
fi

# Deploy Metadata
if ! deploy_contract "$PUBLISHED_OMA3APPMETADATA_ID" "OMA3AppMetadata"; then
    FAILED_CONTRACTS+=("OMA3AppMetadata")
fi

# Deploy Resolver
if ! deploy_contract "$PUBLISHED_OMA3RESOLVERWITHSTORE_ID" "OMA3ResolverWithStore"; then
    FAILED_CONTRACTS+=("OMA3ResolverWithStore")
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

# Save to permanent file
{
    echo "=== Contract Deployment Information ==="
    echo "Deployed: $(date)"
    echo "Environment: $ENVIRONMENT"
    echo "Wallet ID: $WALLET_ID"
    echo "Network: $(grep -o '"network":[0-9]*' <<< "$RESPONSE" | grep -o '[0-9]*' | head -1 || echo "unknown")"
    echo ""
    cat "$DEPLOYED_ADDRESSES_FILE"
    echo ""
} >> "$CONTRACT_ADDRESSES_FILE"

# Clean up temporary file
rm -f "$DEPLOYED_ADDRESSES_FILE"

print_status "Deployed addresses saved to: $CONTRACT_ADDRESSES_FILE"
print_status ""
print_status "Next steps:"
print_status "1. Verify contract deployments on blockchain explorer"
print_status "2. Run: ./configure-contracts.sh $ENVIRONMENT"
print_status "3. Test contract interactions"
