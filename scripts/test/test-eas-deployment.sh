#!/bin/bash

# EAS Deployment Sanity Test
# Tests a deployed EAS system by creating a schema and attestation
# Usage: ./scripts/test/test-eas-deployment.sh [network]
# Example: ./scripts/test/test-eas-deployment.sh omachainTestnet

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get network from argument or default to omachainTestnet
NETWORK=${1:-omachainTestnet}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EAS Deployment Sanity Test${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Register a test schema
echo -e "${YELLOW}Step 1: Registering test schema...${NC}"
SCHEMA_OUTPUT=$(npx hardhat eas-register-schema \
  --network "$NETWORK" \
  --schema "string testName,uint8 testScore" \
  2>&1)

echo "$SCHEMA_OUTPUT"

# Extract schema UID from output
SCHEMA_UID=$(echo "$SCHEMA_OUTPUT" | grep -o "Schema UID: 0x[a-fA-F0-9]*" | cut -d' ' -f3)

if [ -z "$SCHEMA_UID" ]; then
  echo -e "${RED}❌ Failed to extract schema UID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Schema registered: ${SCHEMA_UID}${NC}\n"

# Step 2: Get schema details
echo -e "${YELLOW}Step 2: Retrieving schema details...${NC}"
npx hardhat eas-get-schema \
  --network "$NETWORK" \
  --uid "$SCHEMA_UID"

echo -e "${GREEN}✅ Schema retrieved successfully${NC}\n"

# Step 3: Create an attestation
echo -e "${YELLOW}Step 3: Creating test attestation...${NC}"

# Get the deployer address to use as recipient
DEPLOYER_ADDRESS=$(npx hardhat run --network "$NETWORK" - <<'EOF'
const hre = require("hardhat");
async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(await signer.getAddress());
}
main();
EOF
)

ATTEST_OUTPUT=$(npx hardhat eas-attest \
  --network "$NETWORK" \
  --schema "$SCHEMA_UID" \
  --recipient "$DEPLOYER_ADDRESS" \
  --types "string,uint8" \
  --values "SanityTest,100" \
  2>&1)

echo "$ATTEST_OUTPUT"

# Extract attestation UID from output
ATTESTATION_UID=$(echo "$ATTEST_OUTPUT" | grep -o "Attestation UID: 0x[a-fA-F0-9]*" | cut -d' ' -f3)

if [ -z "$ATTESTATION_UID" ]; then
  echo -e "${RED}❌ Failed to extract attestation UID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Attestation created: ${ATTESTATION_UID}${NC}\n"

# Step 4: Get attestation details
echo -e "${YELLOW}Step 4: Retrieving attestation details...${NC}"
npx hardhat eas-get-attestation \
  --network "$NETWORK" \
  --uid "$ATTESTATION_UID"

echo -e "${GREEN}✅ Attestation retrieved successfully${NC}\n"

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Schema UID:      ${SCHEMA_UID}"
echo -e "Attestation UID: ${ATTESTATION_UID}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${GREEN}Your EAS deployment on ${NETWORK} is working correctly!${NC}"
