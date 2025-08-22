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

// Import task files - Legacy tasks
import "./tasks/legacy/getAppLegacy";
import "./tasks/legacy/getAppsLegacy";
import "./tasks/legacy/getAppsByMinterLegacy";

// Import task files - Inherited functions
import "./tasks/inherited/erc721";
import "./tasks/inherited/ownable";

// Import task files - Metadata tasks  
import "./tasks/metadata/getmetadatajson";
import "./tasks/metadata/setmetadatajson";

// Load deployment key from SSH directory
const deploymentKeyPath = path.join(process.env.HOME || '', '.ssh', 'test-evm-deployment-key');
if (fs.existsSync(deploymentKeyPath)) {
  dotenvConfig({ path: deploymentKeyPath });
}

// Network-specific contract addresses
export const NETWORK_CONTRACTS = {
  thirdwebTestnet: {
    registry: "0x", // TODO: Set after deployment
    metadata: "0x"  // TODO: Set after deployment
  },
  celoAlfajores: {
    registry: "0x", // TODO: Set after deployment
    metadata: "0x"  // TODO: Set after deployment
  },
  hardhat: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x"  // Will be set automatically during local deployment
  },
  localhost: {
    registry: "0x", // Will be set automatically during local deployment
    metadata: "0x"  // Will be set automatically during local deployment
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
    thirdwebTestnet: {
      url: "https://38df867c9941afedf972308db796e2b4.rpc.thirdweb.com",
      chainId: 894538,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto",
      timeout: 60000
    },
    celoAlfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
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
  }
};

export default config;