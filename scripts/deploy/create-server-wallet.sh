#!/bin/bash

# OMA3 Server Wallet Creation Script
# Creates a server wallet with the specified identifier using Thirdweb API
# Usage: ./create-server-wallet.sh <wallet-identifier>

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check arguments
if [ $# -ne 1 ]; then
    print_error "Usage: $0 <wallet-identifier>"
    print_error "Examples:"
    print_error "  $0 OMA3-production-1"
    print_error "  $0 oma3-testnet-1"
    print_error "  $0 my-custom-wallet"
    exit 1
fi

WALLET_IDENTIFIER="$1"

# Get secret key first (needed for wallet listing API call)
if [ -z "$THIRDWEB_SECRET_KEY" ]; then
    echo -n "Enter your Thirdweb secret key (app-registry-evm-solidity project): "
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

print_status "Looking for existing wallet: $WALLET_IDENTIFIER"

# Check if wallet already exists by listing all server wallets
print_status "Checking existing server wallets..."

# List wallets using API directly (instead of calling list-server-wallets.sh)
RESPONSE=$(curl -s -X GET "https://api.thirdweb.com/v1/wallets/server" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "Content-Type: application/json")

# Check for API errors
if echo "$RESPONSE" | grep -q '"error"'; then
    print_error "Failed to list server wallets:"
    echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
    print_status "Proceeding with wallet creation..."
else
    # Check if our wallet identifier exists in the response
    if echo "$RESPONSE" | grep -q "\"identifier\":\"$WALLET_IDENTIFIER\""; then
        print_status "Wallet already exists: $WALLET_IDENTIFIER"
        # Extract existing wallet address
        WALLET_ADDRESS=$(echo "$RESPONSE" | grep -o "\"identifier\":\"$WALLET_IDENTIFIER\"[^}]*\"address\":\"[^\"]*\"" | grep -o '"address":"[^"]*"' | sed 's/"address":"//;s/"//')
        print_status "Using existing wallet: $WALLET_ADDRESS"
        exit 0
    fi
fi

print_status "Wallet not found, creating new wallet: $WALLET_IDENTIFIER"

print_status "Creating server wallet..."

# Create server wallet
RESPONSE=$(curl -s -X POST "https://api.thirdweb.com/v1/wallets/server" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\": \"$WALLET_IDENTIFIER\"}")

# Debug: Show raw response for troubleshooting
print_status "Debug: Raw API response:"
echo "$RESPONSE"

# Check if request was successful
if echo "$RESPONSE" | grep -q '"error"'; then
    print_error "Failed to create server wallet:"
    echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
    exit 1
fi

# Extract wallet address (try multiple possible response formats)
WALLET_ADDRESS=$(echo "$RESPONSE" | grep -o '"address":"[^"]*"' | head -1 | sed 's/"address":"//;s/"//')

# If that doesn't work, try looking for result.address
if [ -z "$WALLET_ADDRESS" ]; then
    WALLET_ADDRESS=$(echo "$RESPONSE" | grep -o '"result":\s*{\s*"address":"[^"]*"' | grep -o '"address":"[^"]*"' | head -1 | sed 's/"address":"//;s/"//')
fi

if [ -z "$WALLET_ADDRESS" ]; then
    print_error "Failed to extract wallet address from response"
    print_error "Response format may be different than expected"
    exit 1
fi

print_status "Server wallet created successfully!"
print_status "Wallet Address: $WALLET_ADDRESS"
print_status "Wallet Identifier: $WALLET_IDENTIFIER"
