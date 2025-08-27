import { ethers, network } from "hardhat";
import { getSecureSigner, verifyBytecode, logTransactionForVerification } from "./signer-utils";

// Parse command line arguments
const args = process.argv.slice(2);
const useSSHKey = args.includes("--ssh-key");

async function main() {
  const networkName = network.name;
  console.log(`\nOMA3AppRegistry Deployment`);
  console.log(`Network: ${networkName}`);
  console.log(`Method: ${useSSHKey ? "SSH Key (--ssh-key)" : "Hardware Wallet (secure default)"}`);
  
  try {
    // Get secure signer
    const { signer, address: deployerAddress, method } = await getSecureSigner(useSSHKey);
    
    // Deploy contract
    const OMA3AppRegistry = await ethers.getContractFactory("OMA3AppRegistry", signer);
    
    // Log transaction for verification (anti-blind-signing)
    await logTransactionForVerification(OMA3AppRegistry, "OMA3AppRegistry");
    
    console.log("\nDeploying contract...");
    if (!useSSHKey) {
      console.log("Please confirm transaction on your Ledger device");
    }
    
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();

    const contractAddress = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${contractAddress}`);

    // Verify deployed bytecode
    await verifyBytecode(contractAddress, OMA3AppRegistry.bytecode, "OMA3AppRegistry");
    
    // Wait for block confirmations
    console.log("\nWaiting for block confirmations...");
    await registry.deploymentTransaction()?.wait(5);
    
    // Final summary
    console.log("\n✅ DEPLOYMENT COMPLETE!");
    console.log("==============================");
    console.log(`Network: ${networkName}`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`Method: ${method}`);
    console.log(`Security: ${useSSHKey ? "Basic" : "Enhanced"}`);
    console.log("==============================");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 