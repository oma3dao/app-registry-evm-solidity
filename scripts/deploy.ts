import { ethers, network } from "hardhat";

async function main() {
  const networkName = network.name;
  console.log(`Deploying to network: ${networkName}`);

  // Check if private key is loaded
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not found. Please check ~/.ssh/test-evm-deployment-key");
  }
  console.log("Private key loaded successfully");
  
  try {
    // Deploy the contract using hardhat's ethers
    const OMA3AppRegistry = await ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log(`OMA3AppRegistry deployed to: ${address}`);

    // Wait for block confirmations
    console.log("Waiting for block confirmations...");
    await registry.deploymentTransaction()?.wait(5);
    
    console.log("Deployment completed successfully!");
    console.log("Contract address:", address);
    console.log("");

  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 