#!/bin/bash

# OMA3 Contract Configuration Script
# Links and configures deployed contracts using admin functions
# Usage: ./configure-contracts.sh <environment>

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
    print_error "Example: $0 production"
    exit 1
fi

ENVIRONMENT=$1
WALLET_IDENTIFIER="oma3-${ENVIRONMENT}-1"

print_header "Configuring contracts for environment: $ENVIRONMENT"
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
    print_error "Make sure to run deploy-contracts.sh first"
    exit 1
fi

# Source deployed addresses
source "$CONTRACT_ADDRESSES_FILE"

# Verify required deployed addresses exist
REQUIRED_ADDRESSES=("DEPLOYED_OMA3APPREGISTRY_ADDRESS" "DEPLOYED_OMA3APPMETADATA_ADDRESS" "DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS")

for addr_var in "${REQUIRED_ADDRESSES[@]}"; do
    if [ -z "${!addr_var}" ]; then
        print_error "Required deployed address not found: $addr_var"
        print_error "Make sure all contracts were deployed successfully"
        exit 1
    fi
done

print_status "Found deployed contract addresses:"
print_status "  Registry: $DEPLOYED_OMA3APPREGISTRY_ADDRESS"
print_status "  Metadata: $DEPLOYED_OMA3APPMETADATA_ADDRESS"
print_status "  Resolver: $DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS"

# Function to call contract function
call_contract_function() {
    local contract_address="$1"
    local function_name="$2"
    local args="$3"
    local description="$4"

    print_status "Calling $function_name on $contract_address..."

    RESPONSE=$(curl -s -X POST "https://api.thirdweb.com/v1/contracts/call" \
      -H "x-secret-key: $SECRET_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"walletId\": \"$WALLET_ID\",
        \"contractAddress\": \"$contract_address\",
        \"functionName\": \"$function_name\",
        \"args\": $args
      }")

    # Check if request was successful
    if echo "$RESPONSE" | grep -q '"error"'; then
        print_error "Failed to call $function_name:"
        echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
        return 1
    fi

    # Extract transaction hash
    TX_HASH=$(echo "$RESPONSE" | grep -o '"transactionHash":"[^"]*"' | head -1 | sed 's/"transactionHash":"//;s/"//')

    if [ -z "$TX_HASH" ]; then
        print_error "Failed to extract transaction hash for $function_name"
        return 1
    fi

    print_status "$description completed: $TX_HASH"
    return 0
}

# Configure contracts
print_header "Configuring contract relationships..."

FAILED_OPERATIONS=()

# 1. Link Registry ↔ Metadata
print_status "Linking Registry and Metadata contracts..."

if ! call_contract_function \
    "$DEPLOYED_OMA3APPREGISTRY_ADDRESS" \
    "setMetadataContract" \
    "[\"$DEPLOYED_OMA3APPMETADATA_ADDRESS\"]" \
    "Registry → Metadata"; then
    FAILED_OPERATIONS+=("Registry → Metadata linking")
fi

if ! call_contract_function \
    "$DEPLOYED_OMA3APPMETADATA_ADDRESS" \
    "setAuthorizedRegistry" \
    "[\"$DEPLOYED_OMA3APPREGISTRY_ADDRESS\"]" \
    "Metadata → Registry"; then
    FAILED_OPERATIONS+=("Metadata → Registry linking")
fi

# 2. Link Registry → Resolvers
print_status "Linking Registry to Resolvers..."

if ! call_contract_function \
    "$DEPLOYED_OMA3APPREGISTRY_ADDRESS" \
    "setOwnershipResolver" \
    "[\"$DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS\"]" \
    "Registry → Ownership Resolver"; then
    FAILED_OPERATIONS+=("Registry → Ownership Resolver linking")
fi

if ! call_contract_function \
    "$DEPLOYED_OMA3APPREGISTRY_ADDRESS" \
    "setDataUrlResolver" \
    "[\"$DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS\"]" \
    "Registry → Data URL Resolver"; then
    FAILED_OPERATIONS+=("Registry → Data URL Resolver linking")
fi

# 3. Configure Resolver (optional)
print_status "Configuring Resolver policies..."

# Add a trusted issuer (example - replace with your actual issuer address)
TRUSTED_ISSUER="0x0000000000000000000000000000000000000000"  # Replace with actual issuer

if ! call_contract_function \
    "$DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS" \
    "setIssuer" \
    "[\"$TRUSTED_ISSUER\", true]" \
    "Add trusted issuer"; then
    print_warning "Failed to add trusted issuer (this may be optional)"
fi

# Check if any operations failed
if [ ${#FAILED_OPERATIONS[@]} -ne 0 ]; then
    print_error "Failed operations: ${FAILED_OPERATIONS[*]}"
    exit 1
fi

print_status "All contract configurations completed successfully!"

# Save configuration information
{
    echo "=== Contract Configuration Information ==="
    echo "Configured: $(date)"
    echo "Environment: $ENVIRONMENT"
    echo ""
    echo "Contract Relationships:"
    echo "  Registry ($DEPLOYED_OMA3APPREGISTRY_ADDRESS) → Metadata ($DEPLOYED_OMA3APPMETADATA_ADDRESS)"
    echo "  Metadata ($DEPLOYED_OMA3APPMETADATA_ADDRESS) → Registry ($DEPLOYED_OMA3APPREGISTRY_ADDRESS)"
    echo "  Registry ($DEPLOYED_OMA3APPREGISTRY_ADDRESS) → Ownership Resolver ($DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS)"
    echo "  Registry ($DEPLOYED_OMA3APPREGISTRY_ADDRESS) → Data URL Resolver ($DEPLOYED_OMA3RESOLVERWITHSTORE_ADDRESS)"
    echo ""
} >> "$CONTRACT_ADDRESSES_FILE"

print_status "Configuration information saved to: $CONTRACT_ADDRESSES_FILE"
print_status ""
print_status "Contract deployment and configuration complete!"
print_status ""
print_status "Next steps:"
print_status "1. Verify contract configurations on blockchain explorer"
print_status "2. Test contract interactions"
print_status "3. Update frontend applications with new contract addresses"
print_status "4. Run integration tests"
