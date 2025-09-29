#!/bin/bash

# OMA3 Contract Publishing Script
# Publishes ALL contract artifacts to Thirdweb using CLI and returns published contract IDs
# Usage: ./publish-contracts.sh (publishes all contracts in the project)

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

# Note: Thirdweb CLI publishes all contracts in the project at once
# We ignore individual contract arguments and publish everything
print_header "Publishing all contracts to Thirdweb using CLI"

# Check for force flag
FORCE_PUBLISH=false
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_PUBLISH=true
    print_status "Force publish enabled - will attempt to republish existing contracts"
    shift
fi

if [ $# -gt 0 ]; then
    print_status "Note: Thirdweb CLI publishes all available contracts in the project"
    print_status "Ignoring individual contract arguments: $@"
fi

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

# Note: Thirdweb CLI will compile contracts automatically, so no need to check for artifacts

# Create temporary file for published IDs
PUBLISHED_IDS_FILE="scripts/deploy/.published-ids.tmp"

print_status "Publishing all contracts (Thirdweb CLI will compile automatically)..."

# Run the thirdweb publish command with input redirection to prevent hanging
print_status "Running: npx thirdweb publish -k [SECRET] --debug"
print_status "Note: This may take a few minutes to compile and upload contracts..."

# Run the publish command with proper input handling for interactive selection
# The CLI shows 6 contracts, use space to select each, then return to submit
{
    sleep 2          # Wait for prompt to appear
    printf " "       # Space to select contract 1
    sleep 0.5
    printf " "       # Space to select contract 2
    sleep 0.5
    printf " "       # Space to select contract 3
    sleep 0.5
    printf " "       # Space to select contract 4
    sleep 0.5
    printf " "       # Space to select contract 5
    sleep 0.5
    printf " "       # Space to select contract 6
    sleep 0.5
    printf "\n"      # Return to submit selection
    sleep 1
} | npx thirdweb publish -k "$SECRET_KEY" --debug > /tmp/thirdweb_publish.log 2>&1 &

# Get the background process ID
PUBLISH_PID=$!
print_status "Background publish process started with PID: $PUBLISH_PID"

# Wait for the process with a timeout-like behavior
WAIT_COUNT=0
MAX_WAIT=120  # 2 minutes

while kill -0 $PUBLISH_PID 2>/dev/null; do
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        print_warning "Publish process taking longer than expected, checking output..."
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
        print_status "Still publishing... ($WAIT_COUNT seconds elapsed)"
    fi
done

# Wait for the process to complete and get exit code
wait $PUBLISH_PID 2>/dev/null
PUBLISH_EXIT_CODE=$?

# Get the output
PUBLISH_OUTPUT=$(cat /tmp/thirdweb_publish.log 2>/dev/null || echo "No output captured")

print_status "Publish command completed with exit code: $PUBLISH_EXIT_CODE"

print_status "Publish CLI Output:"
echo "$PUBLISH_OUTPUT"

if [ $PUBLISH_EXIT_CODE -ne 0 ]; then
    print_error "Publish failed with exit code: $PUBLISH_EXIT_CODE"
    exit 1
fi

# Check if CLI command was successful
if echo "$PUBLISH_OUTPUT" | grep -q "error\|Error\|ERROR\|failed\|Failed\|FAILED"; then
    print_error "Failed to publish contracts using Thirdweb CLI"
    exit 1
fi

# Extract the published contract URL (new format from CLI output)
PUBLISH_URL=$(echo "$PUBLISH_OUTPUT" | grep -o "https://thirdweb.com/contracts/publish/[^[:space:]]*")

if [ -z "$PUBLISH_URL" ]; then
    # Try alternative extraction pattern
    PUBLISH_URL=$(echo "$PUBLISH_OUTPUT" | grep -o "https://thirdweb.com/contracts/publish?ipfs=[^[:space:]]*")
fi

if [ -z "$PUBLISH_URL" ]; then
    print_error "Failed to extract publish URL from CLI output"
    print_error "CLI may have succeeded but output format is unexpected"
    print_error "Please check the output above for the publish URL"
    exit 1
fi

print_status "Successfully published contracts!"
print_status "Publish URL: $PUBLISH_URL"

# Store the publish URL
echo "PUBLISHED_CONTRACTS_URL=$PUBLISH_URL" >> "$PUBLISHED_IDS_FILE"

# Extract the IPFS hash from the URL for easier reference
IPFS_HASH=$(echo "$PUBLISH_URL" | sed 's/.*\/publish\///' | sed 's/?.*$//')
if [ -n "$IPFS_HASH" ]; then
    echo "PUBLISHED_IPFS_HASH=$IPFS_HASH" >> "$PUBLISHED_IDS_FILE"
    print_status "IPFS Hash: $IPFS_HASH"
fi

print_status "Contracts published at: $PUBLISH_URL"

# Display published IDs
print_header "Published Contract IDs:"
cat "$PUBLISHED_IDS_FILE"

# Save to permanent file
CONTRACT_ADDRESSES_FILE="scripts/deploy/contract-addresses.txt"
{
    echo "=== Contract Publishing Information ==="
    echo "Published: $(date)"
    echo "Contracts: ${CONTRACTS[*]}"
    echo ""
    cat "$PUBLISHED_IDS_FILE"
    echo ""
} >> "$CONTRACT_ADDRESSES_FILE"

# Clean up temporary files
rm -f "$PUBLISHED_IDS_FILE"
rm -f /tmp/thirdweb_publish.log

print_status "Published IDs saved to: $CONTRACT_ADDRESSES_FILE"
print_status ""
print_status "Next steps:"
print_status "1. Verify published contracts in Thirdweb dashboard"
print_status "2. Run: ./deploy-contracts.sh <environment>"
print_status "   Example: ./deploy-contracts.sh production"
