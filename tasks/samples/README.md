# Sample Data Files

This folder contains sample configurations and metadata for OMA3 registry operations.

## Files

### Registry Sample
- **`sample-registry-mint.json`** - General mint configuration (works for any interface type)

### Metadata Samples (Interface-Specific)
- **`sample-metadata-human.json`** - Human interface (Interface 1) - games, worlds, user-facing apps
- **`sample-metadata-api.json`** - API interface (Interface 2) - data services, REST APIs  
- **`sample-metadata-mcp.json`** - MCP interface (Interface 4) - Model Context Protocol servers

## Interface Types

- **1 = Human** - Apps with user interfaces (games, worlds, tools)
- **2 = API** - Programmatic services and APIs  
- **4 = MCP** - Model Context Protocol servers
- **Combinations** - Add values to combine (e.g., 7 = 1+2+4 = Human+API+MCP)

## Quick Start

1. **Choose your interface type** (human, API, or MCP)
2. **Use the registry sample** for mint parameters
3. **Use the matching metadata sample** for your interface type
4. **Modify both** for your specific app

Example workflow:
```bash
# 1. Create your metadata JSON based on interface type
cp tasks/samples/sample-metadata-human.json my-app-metadata.json
# Edit my-app-metadata.json for your app

# 2. Mint using registry sample as reference
npx hardhat mint \
  --did "did:oma3:my-game" \
  --interfaces 1 \
  --dataurl "https://my-game.com/metadata.json" \
  --jsonfile "my-app-metadata.json" \
  --keywords "game,3d,multiplayer"
```

## Usage Examples

### 1. Mint a Human App (Game/World)
```bash
npx hardhat mint \
  --did "did:oma3:my-awesome-game" \
  --interfaces 1 \
  --dataurl "https://my-game.com/metadata.json" \
  --keywords "game,adventure,3d,multiplayer"
```

### 2. Mint an API Service  
```bash
npx hardhat mint \
  --did "did:oma3:weather-service" \
  --interfaces 2 \
  --dataurl "https://api.weather.com/v1/metadata.json" \
  --keywords "weather,api,forecast,data"
```

### 3. Mint an MCP Server
```bash
npx hardhat mint \
  --did "did:oma3:file-tools-mcp" \
  --interfaces 4 \
  --dataurl "https://github.com/user/file-tools/metadata.json" \
  --keywords "mcp,files,tools,automation"
```

### 4. Mint App with Embedded Metadata
```bash
npx hardhat mint \
  --did "did:oma3:my-app" \
  --interfaces 1 \
  --dataurl "https://my-app.com/metadata.json" \
  --jsonfile "tasks/samples/sample-metadata-human.json" \
  --keywords "demo,test"
```

### 5. Set Metadata for Existing App
```bash
npx hardhat set-metadata-json \
  --did "did:oma3:my-app" \
  --major 1 \
  --jsonfile "tasks/samples/sample-metadata-human.json"
```

## Parameter Reference

### Required Parameters
- **`--did`** - Unique identifier (format: `did:oma3:your-app-name`)
- **`--interfaces`** - Interface bitmap (1, 2, 4, or combinations)
- **`--dataurl`** - URL to off-chain metadata

### Optional Parameters  
- **`--datahash`** - Pre-computed hash (auto-calculated if not provided)
- **`--algorithm`** - Hash algorithm: `keccak256` (default) or `sha256`
- **`--fungibletokenid`** - CAIP-19 token ID (e.g., `eip155:1:0x.../123`)
- **`--contractid`** - CAIP-10 contract address (e.g., `eip155:1:0x...`)
- **`--major/minor/patch`** - Version numbers (default: 1.0.0)
- **`--keywords`** - Comma-separated tags
- **`--jsonfile`** - Path to metadata JSON or JSON string

## DID Format Guidelines

DIDs should follow the pattern: `did:oma3:descriptive-name`

**Good examples:**
- `did:oma3:awesome-world`
- `did:oma3:weather-api`
- `did:oma3:file-manager-mcp`
- `did:oma3:ai-assistant`

**Avoid:**
- Special characters (except hyphens)
- Spaces or underscores
- Very long names (keep under 50 chars)

## Token Integration (Optional)

For apps associated with tokens, use CAIP standards:

- **Contract ID (CAIP-10):** `eip155:1:0x1234...` (Ethereum mainnet example)
- **Token ID (CAIP-19):** `eip155:1:0x1234.../123` (NFT token 123 example)

## Common Keywords

Organize your apps with descriptive keywords:

**Categories:** `game`, `api`, `mcp`, `tool`, `service`, `world`, `metaverse`
**Functions:** `chat`, `weather`, `finance`, `social`, `productivity`, `entertainment`  
**Tech:** `ai`, `3d`, `vr`, `blockchain`, `automation`, `data`

## Next Steps

1. Copy a sample file that matches your app type
2. Modify the parameters for your specific app
3. Run the mint command
4. Verify registration with: `npx hardhat get-app --did "your-did" --major 1`
