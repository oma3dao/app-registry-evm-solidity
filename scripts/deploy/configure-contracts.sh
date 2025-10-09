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

# Initialize contract addresses
REGISTRY_ADDRESS=""
METADATA_ADDRESS=""
RESOLVER_ADDRESS=""

# Parse arguments
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --registry)
            REGISTRY_ADDRESS="$2"
            shift 2
            ;;
        --metadata)
            METADATA_ADDRESS="$2"
            shift 2
            ;;
        --resolver)
            RESOLVER_ADDRESS="$2"
            shift 2
            ;;
        --help|-h)
            print_status "Usage: $0 <environment> --registry <address> --metadata <address> --resolver <address>"
            print_status "Examples:"
            print_status "  $0 testnet --registry 0x742d35... --metadata 0x9f1f55... --resolver 0x24B0B17..."
            print_status "  $0 mainnet --registry 0x742d35... --metadata 0x9f1f55... --resolver 0x24B0B17..."
            print_status "  $0 testnet --resolver 0x24B0B17... --registry 0x742d35... --metadata 0x9f1f55..."
            print_status ""
            print_status "Contract addresses should be the deployed contract addresses from deploy-contracts.sh"
            print_status "All three contracts are required for complete system configuration"
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
    print_error "Usage: $0 <environment> --registry <address> --metadata <address> --resolver <address>"
    exit 1
fi

# Validate all three contracts are specified (required for complete system)
if [ -z "$REGISTRY_ADDRESS" ]; then
    print_error "Registry contract address is required"
    print_error "Use --registry <address> flag"
    exit 1
fi

if [ -z "$METADATA_ADDRESS" ]; then
    print_error "Metadata contract address is required"
    print_error "Use --metadata <address> flag"
    exit 1
fi

if [ -z "$RESOLVER_ADDRESS" ]; then
    print_error "Resolver contract address is required"
    print_error "Use --resolver <address> flag"
    exit 1
fi

WALLET_IDENTIFIER="oma3-${ENVIRONMENT}-1"

print_header "Configuring contracts for environment: $ENVIRONMENT"
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

print_status "Contracts to configure:"
print_status "  Registry: $REGISTRY_ADDRESS"
print_status "  Metadata: $METADATA_ADDRESS"
print_status "  Resolver: $RESOLVER_ADDRESS"

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
    "$REGISTRY_ADDRESS" \
    "setMetadataContract" \
    "[\"$METADATA_ADDRESS\"]" \
    "Registry → Metadata"; then
    FAILED_OPERATIONS+=("Registry → Metadata linking")
fi

if ! call_contract_function \
    "$METADATA_ADDRESS" \
    "setAuthorizedRegistry" \
    "[\"$REGISTRY_ADDRESS\"]" \
    "Metadata → Registry"; then
    FAILED_OPERATIONS+=("Metadata → Registry linking")
fi

# 2. Link Registry → Resolvers
print_status "Linking Registry to Resolvers..."

if ! call_contract_function \
    "$REGISTRY_ADDRESS" \
    "setOwnershipResolver" \
    "[\"$RESOLVER_ADDRESS\"]" \
    "Registry → Ownership Resolver"; then
    FAILED_OPERATIONS+=("Registry → Ownership Resolver linking")
fi

if ! call_contract_function \
    "$REGISTRY_ADDRESS" \
    "setDataUrlResolver" \
    "[\"$RESOLVER_ADDRESS\"]" \
    "Registry → Data URL Resolver"; then
    FAILED_OPERATIONS+=("Registry → Data URL Resolver linking")
fi

# 3. Configure Resolver
print_status "Configuring Resolver policies..."

# Add a trusted issuer (example - replace with your actual issuer address)
TRUSTED_ISSUER="0x0000000000000000000000000000000000000000"  # Replace with actual issuer

if ! call_contract_function \
    "$RESOLVER_ADDRESS" \
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
