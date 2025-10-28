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

// Import task files - Admin tasks
import "./tasks/admin/registry-set-metadata-contract";
import "./tasks/admin/registry-set-ownership-resolver";
import "./tasks/admin/registry-set-dataurl-resolver";
import "./tasks/admin/registry-set-require-attestation";
import "./tasks/admin/registry-transfer-owner";
import "./tasks/admin/metadata-authorize-registry";
import "./tasks/admin/metadata-transfer-owner";
import "./tasks/admin/resolver-set-maturation";
import "./tasks/admin/resolver-set-max-ttl";
import "./tasks/admin/resolver-add-issuer";
import "./tasks/admin/resolver-remove-issuer";
import "./tasks/admin/resolver-transfer-owner";
import "./tasks/admin/resolver-view-attestations";

// Import task files - Inherited functions
import "./tasks/inherited/erc721";
import "./tasks/inherited/ownable";

// Import task files - Metadata tasks
import "./tasks/metadata/metadata-get-json";

// Import task files - Resolver tasks
import "./tasks/resolver";

// Import task files - EAS tasks
import "./tasks/eas/eas-register-schema";
import "./tasks/eas/eas-get-schema";
import "./tasks/eas/eas-attest";
import "./tasks/eas/eas-get-attestation";
import "./tasks/eas/eas-revoke";
import "./tasks/eas/eas-encode-data";

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
  omachainTestnet: {
    registry: "0x63A7C12f54B4f42Cae7234f7e20c7A08f725B9F9",
    metadata: "0xFdd87eA429D963eCB671D409128dC94BFf5f0694",
    resolver: "0x77E058106762AeA4A567f2919Ef896bb6A82f914",
    easSchemaRegistry: "0x9a530e23370C7d820FbaB2E0a884c58be5E4e919",
    easContract: "0xDc120C00E62822329A4d8C7808f5a43C9CbfC1f8"
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