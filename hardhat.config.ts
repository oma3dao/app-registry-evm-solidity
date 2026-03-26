import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import "solidity-coverage";

// Load environment variables from .env file
dotenvConfig();

// Import task files - Registry tasks
import "./tasks/registry/registry-get-app";
import "./tasks/registry/registry-get-apps";
import "./tasks/registry/registry-get-apps-by-interface";
import "./tasks/registry/registry-get-apps-by-owner";
import "./tasks/registry/registry-get-apps-by-status";
import "./tasks/registry/registry-get-did-hash";
import "./tasks/registry/registry-has-traits";
import "./tasks/registry/registry-mint";
import "./tasks/registry/registry-token-uri";
import "./tasks/registry/registry-total-supply";
import "./tasks/registry/registry-update-app-controlled";
import "./tasks/registry/registry-update-status";
import "./tasks/deploy/system";
import "./tasks/deploy/registry";
import "./tasks/deploy/metadata";
import "./tasks/deploy/resolver";
import "./tasks/deploy/eas-system";
import "./tasks/deploy/fee-resolver";
import "./tasks/deploy/fee-resolver-sanity";
import "./tasks/deploy/update-frontend-abis";
import "./tasks/deploy/check-contracts";
import "./tasks/deploy/eas-sanity";
import "./tasks/deploy/timelock";

// Import task files - Setup tasks (initial config using deployment key)
import "./tasks/setup/registry-set-metadata-contract";
import "./tasks/setup/registry-set-ownership-resolver";
import "./tasks/setup/registry-set-dataurl-resolver";
import "./tasks/setup/registry-set-registration-resolver";
import "./tasks/setup/registry-set-require-attestation";
import "./tasks/setup/registry-transfer-owner";
import "./tasks/setup/metadata-authorize-registry";
import "./tasks/setup/metadata-transfer-owner";
import "./tasks/setup/resolver-set-maturation";
import "./tasks/setup/resolver-set-max-ttl";
import "./tasks/setup/resolver-add-issuer";
import "./tasks/setup/resolver-remove-issuer";
import "./tasks/setup/resolver-transfer-owner";

// Import task files - Admin tasks (read-only, no ownership required)
import "./tasks/admin/resolver-view-attestations";

// Import task files - Inherited functions
import "./tasks/inherited/erc721";
import "./tasks/inherited/ownable";

// Import task files - Metadata tasks
import "./tasks/metadata/metadata-get-json";

// Import task files - Resolver tasks
import "./tasks/resolver";

// Load deployment key from SSH file path.
// Resolution order:
//   1. DEPLOYMENT_KEY_PATH env var (explicit override)
//   2. Network-specific default:
//      - ~/.ssh/mainnet-evm-deployment-key  (if --network contains "mainnet")
//      - ~/.ssh/test-evm-deployment-key     (all other networks)
//   3. Hard error if the resolved file does not exist (non-local networks only)
function resolveDeploymentKeyPath(): string {
  if (process.env.DEPLOYMENT_KEY_PATH) {
    return process.env.DEPLOYMENT_KEY_PATH;
  }
  // Parse --network from process.argv (Hardhat hasn't parsed it yet at config time)
  const networkIdx = process.argv.indexOf('--network');
  const networkName = networkIdx !== -1 ? process.argv[networkIdx + 1] : '';

  // Exact match — no substring inference
  const MAINNET_NETWORKS = ['omachainMainnet'];
  const isMainnet = MAINNET_NETWORKS.includes(networkName || '');
  const keyFile = isMainnet ? 'mainnet-evm-deployment-key' : 'test-evm-deployment-key';
  return path.join(process.env.HOME || '', '.ssh', keyFile);
}

const deploymentKeyPath = resolveDeploymentKeyPath();

function loadPrivateKeyFromSshFile(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      // For non-local networks, a missing key file is a hard error
      const networkIdx = process.argv.indexOf('--network');
      const networkName = networkIdx !== -1 ? process.argv[networkIdx + 1] : '';
      const isLocal = !networkName || networkName === 'hardhat' || networkName === 'localhost';
      if (!isLocal) {
        console.error(`\n❌ Deployment key not found: ${filePath}`);
        console.error(`Set DEPLOYMENT_KEY_PATH or create the key file.`);
        process.exit(1);
      }
      return undefined;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return undefined;

    // Support either raw hex or a single-line PRIVATE_KEY=... format
    const match = raw.match(/^\s*PRIVATE_KEY\s*=\s*(.+)\s*$/);
    let key = match ? match[1].trim() : raw;

    // Normalize: strip 0x prefix if present
    key = key.replace(/^0x/i, '');

    // Must be 64 hex characters
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      console.error(`\n❌ Invalid key format in ${filePath}. Expected 64 hex chars.`);
      process.exit(1);
    }

    console.log(`Deployment key: ${filePath}`);
    return `0x${key}`;
  } catch (err) {
    console.error(`\n❌ Failed to read deployment key: ${(err as Error).message}`);
    process.exit(1);
  }
}

const privateKeyFromSsh = loadPrivateKeyFromSshFile(deploymentKeyPath);

// Expose for scripts that currently read process.env.PRIVATE_KEY
if (privateKeyFromSsh) {
  process.env.PRIVATE_KEY = privateKeyFromSsh;
}

// Network-specific contract addresses
export const NETWORK_CONTRACTS = {
  omachainTestnet: {
    registry: "0xB752303DECf6b2c5B12818e50Dd8A20EBe0F5F97",
    metadata: "0x9a530e23370C7d820FbaB2E0a884c58be5E4e919",
    resolver: "0xDc120C00E62822329A4d8C7808f5a43C9CbfC1f8",
    easSchemaRegistry: "0x7946127D2f517c8584FdBF801b82F54436EC6FC7",
    easContract: "0x8835AF90f1537777F52E482C8630cE4e947eCa32"
  },
  omachainMainnet: {
    registry: "0x", 
    metadata: "0x", 
    resolver: "0x",
    easSchemaRegistry: "0x",
    easContract: "0x"
  },
  hardhat: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x", // Will be set automatically during local deployment
    resolver: "0x",  // Will be set automatically during local deployment
    easSchemaRegistry: "0x",
    easContract: "0x"
  },
  localhost: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x", // Will be set automatically during local deployment
    resolver: "0x",  // Will be set automatically during local deployment
    easSchemaRegistry: "0x",
    easContract: "0x"
  }
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true,
          evmVersion: "cancun"
        }
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          viaIR: true,
          evmVersion: "cancun"
        }
      }
    ]
  },
  networks: {
    omachainTestnet: {
      url: "https://rpc.testnet.chain.oma3.org/",
      chainId: 66238,
      accounts: privateKeyFromSsh ? [privateKeyFromSsh] : [],
      gasPrice: "auto",
      gas: "auto",
      timeout: 60000
    },
    omachainMainnet: {
      url: "https://rpc.chain.oma3.org/",
      chainId: 999999,
      accounts: privateKeyFromSsh ? [privateKeyFromSsh] : [],
      gasPrice: "auto",
      gas: "auto",
      timeout: 60000
    },
    // Add other networks as needed
    hardhat: {
      chainId: 31337,
      gasPrice: "auto",
      gas: "auto"
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      gasPrice: "auto",
      gas: "auto"
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined
  },
  etherscan: {
    apiKey: {
      celoAlfajores: process.env.CELOSCAN_API_KEY || "",
      omachainTestnet: process.env.OMACHAIN_API_KEY || ""
    },
    customChains: [
      {
        network: "omachainTestnet",
        chainId: 66238,
        urls: {
          apiURL: "https://explorer.testnet.chain.oma3.org/api",
          browserURL: "https://explorer.testnet.chain.oma3.org/"
        }
      }
    ]
  }
};

export default config;