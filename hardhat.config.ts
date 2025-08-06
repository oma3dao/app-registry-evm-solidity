import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
dotenvConfig();

// Import task files
require('./tasks/getApp');
require('./tasks/getAppsByMinter');
require('./tasks/getApps');

// Import legacy task files
require('./tasks/getAppLegacy');
require('./tasks/getAppsByMinterLegacy');
require('./tasks/getAppsLegacy');

// Load deployment key from SSH directory
const deploymentKeyPath = path.join(process.env.HOME || '', '.ssh', 'test-evm-deployment-key');
if (fs.existsSync(deploymentKeyPath)) {
  dotenvConfig({ path: deploymentKeyPath });
}

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