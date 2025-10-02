import { task } from "hardhat/config";
import type { Signer } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSecureSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";

interface DeploymentResult {
  registry: any;
  metadata: any;
  resolver: any;
  network: string;
  timestamp: string;
}

async function deployRegistry(hre: HardhatRuntimeEnvironment, signer: Signer): Promise<any> {
  console.log("Deploying OMA3AppRegistry...");
  try {
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry", signer);
    await logTransactionForVerification(hre, OMA3AppRegistry, "OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    const address = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3AppRegistry");
    
    // Use fewer confirmations for local networks
    const confirmations = ["localhost", "hardhat"].includes(hre.network.name) ? 1 : 3;
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await registry.deploymentTransaction()?.wait(confirmations);
    return registry;
  } catch (error: any) {
    console.error("❌ Registry deployment failed:", error.message);
    throw error;
  }
}

async function deployMetadata(hre: HardhatRuntimeEnvironment, signer: Signer): Promise<any> {
  console.log("Deploying OMA3AppMetadata...");
  try {
    const OMA3AppMetadata = await hre.ethers.getContractFactory("OMA3AppMetadata", signer);
    await logTransactionForVerification(hre, OMA3AppMetadata, "OMA3AppMetadata");
    const metadata = await OMA3AppMetadata.deploy();
    await metadata.waitForDeployment();
    const address = await metadata.getAddress();
    console.log(`✅ OMA3AppMetadata deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3AppMetadata");
    
    // Use fewer confirmations for local networks
    const confirmations = ["localhost", "hardhat"].includes(hre.network.name) ? 1 : 3;
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await metadata.deploymentTransaction()?.wait(confirmations);
    return metadata;
  } catch (error: any) {
    console.error("❌ Metadata deployment failed:", error.message);
    throw error;
  }
}

async function deployResolver(hre: HardhatRuntimeEnvironment, signer: Signer): Promise<any> {
  console.log("Deploying OMA3ResolverWithStore...");
  try {
    const OMA3ResolverWithStore = await hre.ethers.getContractFactory("OMA3ResolverWithStore", signer);
    await logTransactionForVerification(hre, OMA3ResolverWithStore, "OMA3ResolverWithStore");
    const resolver = await OMA3ResolverWithStore.deploy();
    await resolver.waitForDeployment();
    const address = await resolver.getAddress();
    console.log(`✅ OMA3ResolverWithStore deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3ResolverWithStore");
    
    // Use fewer confirmations for local networks
    const confirmations = ["localhost", "hardhat"].includes(hre.network.name) ? 1 : 3;
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await resolver.deploymentTransaction()?.wait(confirmations);
    return resolver;
  } catch (error: any) {
    console.error("❌ Resolver deployment failed:", error.message);
    throw error;
  }
}

async function linkContracts(registry: any, metadata: any, resolver: any): Promise<void> {
  console.log("Linking contracts...");
  try {
    const registryAddress = await registry.getAddress();
    const metadataAddress = await metadata.getAddress();
    const resolverAddress = await resolver.getAddress();
    
    console.log("Setting metadata contract in registry...");
    const setMetadataTx = await registry.setMetadataContract(metadataAddress);
    await setMetadataTx.wait();
    
    console.log("Authorizing registry in metadata contract...");
    const authorizeTx = await metadata.setAuthorizedRegistry(registryAddress);
    await authorizeTx.wait();
    
    console.log("Setting ownership resolver in registry...");
    const setOwnershipTx = await registry.setOwnershipResolver(resolverAddress);
    await setOwnershipTx.wait();
    
    console.log("Setting data URL resolver in registry...");
    const setDataUrlTx = await registry.setDataUrlResolver(resolverAddress);
    await setDataUrlTx.wait();
    
    console.log("✅ All contracts linked successfully");
  } catch (error: any) {
    console.error("❌ Contract linking failed:", error.message);
    throw error;
  }
}

async function testIntegration(registry: any, metadata: any, resolver: any): Promise<void> {
  console.log("Testing integration...");
  try {
    const metadataAddress = await registry.metadataContract();
    const authorizedRegistry = await metadata.authorizedRegistry();
    const ownershipResolver = await registry.ownershipResolver();
    const dataUrlResolver = await registry.dataUrlResolver();
    
    console.log(`Registry knows metadata at: ${metadataAddress}`);
    console.log(`Metadata authorized registry: ${authorizedRegistry}`);
    console.log(`Registry ownership resolver: ${ownershipResolver}`);
    console.log(`Registry data URL resolver: ${dataUrlResolver}`);
    
    const resolverAddress = await resolver.getAddress();
    const registryAddress = await registry.getAddress();
    const metadataContractAddress = await metadata.getAddress();
    
    if (metadataAddress === metadataContractAddress && 
        authorizedRegistry === registryAddress &&
        ownershipResolver === resolverAddress &&
        dataUrlResolver === resolverAddress) {
      console.log("✅ Integration test PASSED - all contracts are properly linked");
    } else {
      console.log("❌ Integration test FAILED - contracts not properly linked");
    }
  } catch (error: any) {
    console.log("❌ Integration test FAILED:", error.message);
  }
}

async function saveDeploymentInfo(result: DeploymentResult): Promise<void> {
  const { registry, metadata, resolver, network, timestamp } = result;
  const registryAddress = await registry.getAddress();
  const metadataAddress = await metadata.getAddress();
  const resolverAddress = await resolver.getAddress();
  
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("==============================");
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Registry: ${registryAddress}`);
  console.log(`Metadata: ${metadataAddress}`);
  console.log(`Resolver: ${resolverAddress}`);
  console.log("==============================");
  console.log("\nEnvironment Variables:");
  console.log(`export APP_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`export APP_METADATA_ADDRESS=${metadataAddress}`);
  console.log(`export APP_RESOLVER_ADDRESS=${resolverAddress}`);
  console.log("\nNext Steps:");
  console.log("1. Set the environment variables above");
  console.log("2. Update your .env file or deployment configuration");
  console.log("3. Test the deployment with Hardhat tasks");
  console.log("\nExample usage:");
  console.log(`npx hardhat get-apps --network ${network}`);
  console.log(`npx hardhat get-metadata-json --did "did:oma3:example" --network ${network}`);
  console.log(`npx hardhat configure-resolver --resolver ${resolverAddress} --maturation 0 --network ${network}`);
}

task("deploy-system", "Deploy the OMA3 App Registry + Metadata + Resolver system (development only - use Thirdweb Dashboard for production)")
  .addFlag("noLink", "Skip linking Registry, Metadata, and Resolver contracts")
  .addFlag("noTest", "Skip integration test after deployment (default is to test)")
  .setAction(async (taskArgs, hre) => {
    console.log("Note: This is for development/testing only.");
    console.log("For production deployment, use Thirdweb Dashboard for maximum security.");
    
    const networkName = hre.network.name;
    const isProductionNetwork = ["celo", "mainnet", "ethereum", "polygon", "arbitrum", "base"].includes(networkName);
    console.log(`\nDeploying OMA3 Application System to: ${networkName}`);
    console.log(`Mode: ${isProductionNetwork ? "PRODUCTION" : "DEVELOPMENT"}`);
    console.log(`Link contracts: ${!Boolean(taskArgs.noLink) ? "YES" : "NO"}`);
    console.log(`Test integration: ${!Boolean(taskArgs.noTest) ? "YES" : "NO"}`);
    console.log(`Security: SSH Key (development only)`);

    try {
      const { signer, address: deployerAddress, method } = await getSecureSigner(hre);
      console.log(`Deployer: ${deployerAddress} (${method})`);
      console.log("\nPhase 1: Secure Contract Deployment");
      const registry = await deployRegistry(hre, signer);
      const metadata = await deployMetadata(hre, signer);
      const resolver = await deployResolver(hre, signer);
      
      if (!Boolean(taskArgs.noLink)) {
        console.log("\nPhase 2: Contract Integration");
        await linkContracts(registry, metadata, resolver);
      }
      if (!Boolean(taskArgs.noTest)) {
        console.log("\nPhase 3: Integration Testing");
        await testIntegration(registry, metadata, resolver);
      }
      console.log("\nPhase 4: Deployment Summary");
      await saveDeploymentInfo({
        registry,
        metadata,
        resolver,
        network: networkName,
        timestamp: new Date().toISOString()
      });
      // Only suggest verification for networks with block explorers
      if (!["localhost", "hardhat"].includes(networkName)) {
        console.log("\nTip: Verify contracts on the explorer (recommended):");
        console.log(`npx hardhat verify --network ${networkName} ${await registry.getAddress()}`);
        console.log(`npx hardhat verify --network ${networkName} ${await metadata.getAddress()}`);
        console.log(`npx hardhat verify --network ${networkName} ${await resolver.getAddress()}`);
      } else {
        console.log("\n💡 Note: Contract verification is not available on local networks.");
        console.log("Deploy to a testnet (e.g., omachainTestnet) to verify on block explorers.");
      }
    } catch (error: any) {
      console.error("❌ Deployment failed:", error.message);
      throw error;
    }
  });