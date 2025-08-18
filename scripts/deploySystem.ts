import { ethers, network } from "hardhat";

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes("--production") || args.includes("-p");
const shouldLinkContracts = !args.includes("--no-link");
const testConnection = args.includes("--test");

interface DeploymentResult {
  registry: any;
  metadata: any;
  network: string;
  timestamp: string;
}

async function deployRegistry(): Promise<any> {
  console.log("📦 Deploying OMA3AppRegistry...");
  
  try {
    const OMA3AppRegistry = await ethers.getContractFactory("OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();

    const address = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${address}`);
    
    // Wait for confirmations
    console.log("Waiting for block confirmations...");
    await registry.deploymentTransaction()?.wait(3);
    
    return registry;
  } catch (error: any) {
    console.error("❌ Registry deployment failed:", error.message);
    throw error;
  }
}

async function deployMetadata(): Promise<any> {
  console.log("📦 Deploying OMA3AppMetadata...");
  
  try {
    const OMA3AppMetadata = await ethers.getContractFactory("OMA3AppMetadata");
    const metadata = await OMA3AppMetadata.deploy();
    await metadata.waitForDeployment();

    const address = await metadata.getAddress();
    console.log(`✅ OMA3AppMetadata deployed to: ${address}`);
    
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
  console.log("🔗 Linking contracts...");
  
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
  console.log("🧪 Testing integration...");
  
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
  
  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("==============================");
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`Metadata: ${metadataAddress}`);
  console.log("==============================");
  
  console.log("\n📝 Environment Variables:");
  console.log(`export APP_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`export APP_METADATA_ADDRESS=${metadataAddress}`);
  
  console.log("\n🔧 Next Steps:");
  console.log("1. Set the environment variables above");
  console.log("2. Update your .env file or deployment configuration");
  console.log("3. Test the deployment with Hardhat tasks");
  console.log("\nExample usage:");
  console.log(`npx hardhat get-apps --network ${network}`);
  console.log(`npx hardhat get-metadata-json --did "did:oma3:example" --network ${network}`);
}

async function main() {
  const networkName = network.name;
  console.log(`\n🚀 Deploying OMA3 Application System to: ${networkName}`);
  console.log(`Mode: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`Link contracts: ${shouldLinkContracts ? "YES" : "NO"}`);
  console.log(`Test integration: ${testConnection ? "YES" : "NO"}`);

  // Check if private key is loaded
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not found. Please check ~/.ssh/test-evm-deployment-key");
  }
  console.log("✅ Private key loaded successfully");
  
  try {
    // Phase 1: Deploy contracts
    const registry = await deployRegistry();
    const metadata = await deployMetadata();
    
    // Phase 2: Link contracts (optional)
    if (shouldLinkContracts) {
      await linkContracts(registry, metadata);
    }
    
    // Phase 3: Test integration (optional)
    if (testConnection) {
      await testIntegration(registry, metadata);
    }
    
    // Phase 4: Display results
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
