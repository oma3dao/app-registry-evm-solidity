#!/bin/bash

# OMA3 Server Wallet Listing Script
# Lists all server wallets in the Thirdweb project
# Usage: ./list-server-wallets.sh

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

print_status "OMA3 Server Wallet Listing Tool"
print_status "=================================="

# Prompt for secret key securely
echo -n "Enter your Thirdweb secret key (app-registry-evm-solidity project): "
read -s SECRET_KEY
echo ""

if [ -z "$SECRET_KEY" ]; then
    print_error "Secret key cannot be empty"
    exit 1
fi

print_status "Fetching server wallets from Thirdweb..."
echo ""

# List all server wallets
RESPONSE=$(curl -s -X GET "https://api.thirdweb.com/v1/wallets/server" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "Content-Type: application/json")

# Show raw response first
print_header "Raw JSON Response:"
echo "$RESPONSE"
echo ""

# Check if request was successful
if echo "$RESPONSE" | grep -q '"error"'; then
    print_error "Failed to list server wallets:"
    echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
    exit 1
fi

# Extract and format each wallet
print_header "Formatted Wallet List:"
echo ""

# Use jq if available, otherwise use basic parsing
if command -v jq &> /dev/null; then
    echo "$RESPONSE" | jq -r '.result.wallets[] | "Identifier: \(.profiles[0].identifier)\nAddress: \(.address)\nSmart Wallet: \(.smartWalletAddress)\n---"'
else
    # Fallback to basic parsing - extract wallets array and process each wallet
    echo "$RESPONSE" | grep -o '"wallets":\[.*\]' | sed 's/"wallets":\[//;s/\]$//' | \
    sed 's/},{/}\n{/g' | while IFS= read -r wallet; do
        if [ -n "$wallet" ]; then
            IDENTIFIER=$(echo "$wallet" | grep -o '"identifier":"[^"]*"' | head -1 | sed 's/"identifier":"//;s/"//')
            ADDRESS=$(echo "$wallet" | grep -o '"address":"[^"]*"' | head -1 | sed 's/"address":"//;s/"//')
            SMART_WALLET=$(echo "$wallet" | grep -o '"smartWalletAddress":"[^"]*"' | head -1 | sed 's/"smartWalletAddress":"//;s/"//')
            
            echo "Identifier: $IDENTIFIER"
            echo "Address: $ADDRESS"
            echo "Smart Wallet: $SMART_WALLET"
            echo "---"
        fi
    done
fi
