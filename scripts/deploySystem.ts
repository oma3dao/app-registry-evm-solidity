import { ethers, network } from "hardhat";
import { getSecureSigner, verifyBytecode, logTransactionForVerification } from "./signer-utils";
import type { Signer } from "ethers";

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes("--production") || args.includes("-p");
const shouldLinkContracts = !args.includes("--no-link");
const testConnection = args.includes("--test");
const useSSHKey = args.includes("--ssh-key");

interface DeploymentResult {
  registry: any;
  metadata: any;
  network: string;
  timestamp: string;
}

async function deployRegistry(signer: Signer): Promise<any> {
  console.log("Deploying OMA3AppRegistry...");
  
  try {
    const OMA3AppRegistry = await ethers.getContractFactory("OMA3AppRegistry", signer);
    
    // Log transaction for verification
    await logTransactionForVerification(OMA3AppRegistry, "OMA3AppRegistry");
    
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${address}`);
    
    // Verify bytecode
    await verifyBytecode(address, OMA3AppRegistry.bytecode, "OMA3AppRegistry");
    
    // Wait for confirmations
    console.log("Waiting for block confirmations...");
    await registry.deploymentTransaction()?.wait(3);
    
    return registry;
  } catch (error: any) {
    console.error("❌ Registry deployment failed:", error.message);
    throw error;
  }
}

async function deployMetadata(signer: Signer): Promise<any> {
  console.log("Deploying OMA3AppMetadata...");
  
  try {
    const OMA3AppMetadata = await ethers.getContractFactory("OMA3AppMetadata", signer);
    
    // Log transaction for verification
    await logTransactionForVerification(OMA3AppMetadata, "OMA3AppMetadata");
    
    const metadata = await OMA3AppMetadata.deploy();
    await metadata.waitForDeployment();

    const address = await metadata.getAddress();
    console.log(`✅ OMA3AppMetadata deployed to: ${address}`);
    
    // Verify bytecode
    await verifyBytecode(address, OMA3AppMetadata.bytecode, "OMA3AppMetadata");
    
    // Wait for confirmations
    console.log("Waiting for block confirmations...");
    await metadata.deploymentTransaction()?.wait(3);
    
    return metadata;
  } catch (error: any) {
    console.error("❌ Metadata deployment failed:", error.message);
    throw error;
  }
}

async function linkContracts(registry: any, metadata: any): Promise<void> {
  console.log("Linking contracts...");
  
  try {
    const registryAddress = await registry.getAddress();
    const metadataAddress = await metadata.getAddress();
    
    // Registry → Metadata
    console.log("Setting metadata contract in registry...");
    const setMetadataTx = await registry.setMetadataContract(metadataAddress);
    await setMetadataTx.wait();
    
    // Metadata ← Registry  
    console.log("Authorizing registry in metadata contract...");
    const authorizeTx = await metadata.setAuthorizedRegistry(registryAddress);
    await authorizeTx.wait();
    
    console.log("✅ Contracts linked successfully");
  } catch (error: any) {
    console.error("❌ Contract linking failed:", error.message);
    throw error;
  }
}

async function testIntegration(registry: any, metadata: any): Promise<void> {
  console.log("Testing integration...");
  
  try {
    // Test that registry can call metadata
    const testDid = "did:oma3:test-integration";
    const testJson = JSON.stringify({ test: true, timestamp: Date.now() });
    
    console.log("Testing registry → metadata call...");
    
    // This should work if contracts are properly linked
    const metadataAddress = await registry.metadataContract();
    const authorizedRegistry = await metadata.authorizedRegistry();
    
    console.log(`Registry knows metadata at: ${metadataAddress}`);
    console.log(`Metadata authorized registry: ${authorizedRegistry}`);
    
    if (metadataAddress === await metadata.getAddress() && 
        authorizedRegistry === await registry.getAddress()) {
      console.log("✅ Integration test PASSED - contracts are properly linked");
    } else {
      console.log("❌ Integration test FAILED - contracts not properly linked");
    }
    
  } catch (error: any) {
    console.log("❌ Integration test FAILED:", error.message);
  }
}

async function saveDeploymentInfo(result: DeploymentResult): Promise<void> {
  const { registry, metadata, network, timestamp } = result;
  
  const registryAddress = await registry.getAddress();
  const metadataAddress = await metadata.getAddress();
  
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("==============================");
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`Metadata: ${metadataAddress}`);
  console.log("==============================");
  
  console.log("\nEnvironment Variables:");
  console.log(`export APP_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`export APP_METADATA_ADDRESS=${metadataAddress}`);
  
  console.log("\nNext Steps:");
  console.log("1. Set the environment variables above");
  console.log("2. Update your .env file or deployment configuration");
  console.log("3. Test the deployment with Hardhat tasks");
  console.log("\nExample usage:");
  console.log(`npx hardhat get-apps --network ${network}`);
  console.log(`npx hardhat get-metadata-json --did "did:oma3:example" --network ${network}`);
}

async function main() {
  const networkName = network.name;
  console.log(`\nDeploying OMA3 Application System to: ${networkName}`);
  console.log(`Mode: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`Link contracts: ${shouldLinkContracts ? "YES" : "NO"}`);
  console.log(`Test integration: ${testConnection ? "YES" : "NO"}`);
  console.log(`Security: ${useSSHKey ? "SSH Key (--ssh-key)" : "Hardware Wallet (secure default)"}`);

  try {
    // Get secure signer
    const { signer, address: deployerAddress, method } = await getSecureSigner(useSSHKey);
    console.log(`Deployer: ${deployerAddress} (${method})`);
    
    // Phase 1: Deploy contracts
    console.log("\nPhase 1: Secure Contract Deployment");
    if (!useSSHKey) {
      console.log("Please confirm transactions on your Ledger device");
    }
    
    const registry = await deployRegistry(signer);
    const metadata = await deployMetadata(signer);
    
    // Phase 2: Link contracts (optional)
    if (shouldLinkContracts) {
      console.log("\nPhase 2: Contract Integration");
      await linkContracts(registry, metadata);
    }
    
    // Phase 3: Test integration (optional)
    if (testConnection) {
      console.log("\nPhase 3: Integration Testing");
      await testIntegration(registry, metadata);
    }
    
    // Phase 4: Display results
    console.log("\nPhase 4: Deployment Summary");
    await saveDeploymentInfo({
      registry,
      metadata,
      network: networkName,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
