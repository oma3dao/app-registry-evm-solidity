import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import "solidity-coverage";

// Load environment variables from .env file
dotenvConfig();

// Import task files - Registry tasks
import "./tasks/registry/getApp";
import "./tasks/registry/getApps";
import "./tasks/registry/getAppsByMinter";
import "./tasks/registry/updateAppControlled";
import "./tasks/registry/updateStatus";
import "./tasks/registry/getDidHash";
import "./tasks/registry/tokenUri";
import "./tasks/registry/totalSupply";
import "./tasks/registry/hasKeywords";
import "./tasks/registry/getAppsByStatus";
import "./tasks/deploy/system";
import "./tasks/deploy/registry";

// Import task files - Inherited functions
import "./tasks/inherited/erc721";
import "./tasks/inherited/ownable";

// Import task files - Metadata tasks
import "./tasks/metadata/getmetadatajson";

// Import task files - Resolver tasks
import "./tasks/resolver";

// Load deployment key from configurable SSH file path
const deploymentKeyPath = process.env.DEPLOYMENT_KEY_PATH || path.join(process.env.HOME || '', '.ssh', 'test-evm-deployment-key');

function loadPrivateKeyFromSshFile(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return undefined;

    // Support either raw hex or a single-line PRIVATE_KEY=... format
    const match = raw.match(/^\s*PRIVATE_KEY\s*=\s*(.+)\s*$/);
    let key = match ? match[1].trim() : raw;

    // Normalize: strip 0x prefix if present
    key = key.replace(/^0x/i, '');

    // Must be 64 hex characters
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      console.warn("Invalid key format in ~/.ssh/test-evm-deployment-key. Expected 64 hex chars.");
      return undefined;
    }

    return `0x${key}`;
  } catch (err) {
    console.warn("Failed to read ~/.ssh/test-evm-deployment-key:", (err as Error).message);
    return undefined;
  }
}

const privateKeyFromSsh = loadPrivateKeyFromSshFile(deploymentKeyPath);

// Expose for scripts that currently read process.env.PRIVATE_KEY
if (privateKeyFromSsh) {
  process.env.PRIVATE_KEY = privateKeyFromSsh;
}

// Network-specific contract addresses
export const NETWORK_CONTRACTS = {
  thirdwebTestnet: {
    registry: "0x", // TODO: Set after deployment
    metadata: "0x", // TODO: Set after deployment
    resolver: "0x"  // TODO: Set after deployment
  },
  celoAlfajores: {
    registry: "0x1a58589a9989C7E84128938Af06ede00593cFE31",
    metadata: "0x24B0B17adb13DB2146995480e0114b2c93Df217f",
    resolver: "0x"  // TODO: Set after deployment
  },
  omachainTestnet: {
    registry: "0x", // TODO: Set after deployment
    metadata: "0x", // TODO: Set after deployment
    resolver: "0x"  // TODO: Set after deployment
  },
  hardhat: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x", // Will be set automatically during local deployment
    resolver: "0x"  // Will be set automatically during local deployment
  },
  localhost: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x", // Will be set automatically during local deployment
    resolver: "0x"  // Will be set automatically during local deployment
  }
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
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
        network: "celoAlfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io"
        }
      },
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