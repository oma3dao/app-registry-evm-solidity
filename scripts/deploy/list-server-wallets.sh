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
echo -n "Enter your Bitwarden secret key: "
read -s SECRET_KEY
echo ""

if [ -z "$SECRET_KEY" ]; then
    print_error "Secret key cannot be empty"
    exit 1
fi

print_status "Fetching server wallets from Thirdweb..."

# List all server wallets
RESPONSE=$(curl -s -X GET "https://api.thirdweb.com/v1/wallets/server" \
  -H "x-secret-key: $SECRET_KEY" \
  -H "Content-Type: application/json")

# Debug: Show raw response for troubleshooting
print_status "Debug: Raw API response:"
echo "$RESPONSE" | head -5

# Check if request was successful
if echo "$RESPONSE" | grep -q '"error"'; then
    print_error "Failed to list server wallets:"
    echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"//'
    exit 1
fi

# Try multiple ways to extract wallet information
WALLETS=$(echo "$RESPONSE" | grep -o '"wallets":\[[^]]*\]' | sed 's/"wallets"://')

# If that doesn't work, try looking for result array
if [ -z "$WALLETS" ]; then
    WALLETS=$(echo "$RESPONSE" | grep -o '"result":\[[^]]*\]' | sed 's/"result"://')
fi

# If that doesn't work, try looking for data array
if [ -z "$WALLETS" ]; then
    WALLETS=$(echo "$RESPONSE" | grep -o '"data":\[[^]]*\]' | sed 's/"data"://')
fi

if [ -z "$WALLETS" ] || [ "$WALLETS" = "[]" ]; then
    print_status "No server wallets found in this project."
    print_status "Debug: Response structure may be different than expected"
    print_status "Debug: Full response:"
    echo "$RESPONSE"
    exit 0
fi

print_header "Server Wallets Found:"
echo ""

# Parse and display each wallet
echo "$WALLETS" | sed 's/\[//;s/\]//' | sed 's/{/\n---\n/g' | sed 's/},$//' | while IFS= read -r wallet; do
    if [ -n "$wallet" ] && [ "$wallet" != "---" ]; then
        echo "$wallet" | sed 's/,$//' | sed 's/"//g' | sed 's/:/: /' | sed 's/^  //' | sed 's/^/- /'
        echo ""
    fi
done

# Save wallet information
WALLET_FILE="scripts/deploy/wallet-addresses.txt"
{
    echo "=== Server Wallets Listing ==="
    echo "Retrieved: $(date)"
    echo "Source: Thirdweb API"
    echo ""
    echo "$WALLETS" | sed 's/\[//;s/\]//' | sed 's/{/\n--- WALLET ---\n/g' | sed 's/},$//' | sed 's/"//g' | sed 's/:/: /' | sed 's/^  //' | sed 's/^/- /'
    echo ""
} >> "$WALLET_FILE"

print_status "Wallet information saved to: $WALLET_FILE"
print_status ""
print_status "Wallet Management Tips:"
print_status "- Use wallet 'address' field for contract deployments"
print_status "- Use wallet 'identifier' field in deployment scripts"
print_status "- Server wallets are managed by Thirdweb's HSM infrastructure"
print_status "- Wallet addresses are public on the blockchain"
