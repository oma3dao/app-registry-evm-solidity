import type { Signer } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSecureSigner, verifyBytecode, logTransactionForVerification } from "./signer-utils";

interface DeploymentResult {
  registry: any;
  metadata: any;
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
    console.log("Waiting for block confirmations...");
    await registry.deploymentTransaction()?.wait(3);
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
    console.log("Setting metadata contract in registry...");
    const setMetadataTx = await registry.setMetadataContract(metadataAddress);
    await setMetadataTx.wait();
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
    const metadataAddress = await registry.metadataContract();
    const authorizedRegistry = await metadata.authorizedRegistry();
    console.log(`Registry knows metadata at: ${metadataAddress}`);
    console.log(`Metadata authorized registry: ${authorizedRegistry}`);
    if (metadataAddress === await metadata.getAddress() && authorizedRegistry === await registry.getAddress()) {
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

export async function runSystemDeployment(hre: HardhatRuntimeEnvironment, options: {
  shouldLinkContracts: boolean;
  testConnection: boolean;
}): Promise<void> {
  const networkName = hre.network.name;
  const isProductionNetwork = ["celo", "mainnet", "ethereum", "polygon", "arbitrum", "base"].includes(networkName);
  console.log(`\nDeploying OMA3 Application System to: ${networkName}`);
  console.log(`Mode: ${isProductionNetwork ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`Link contracts: ${options.shouldLinkContracts ? "YES" : "NO"}`);
  console.log(`Test integration: ${options.testConnection ? "YES" : "NO"}`);
  console.log(`Security: SSH Key (development only)`);

  try {
    const { signer, address: deployerAddress, method } = await getSecureSigner(hre);
    console.log(`Deployer: ${deployerAddress} (${method})`);
    console.log("\nPhase 1: Secure Contract Deployment");
    const registry = await deployRegistry(hre, signer);
    const metadata = await deployMetadata(hre, signer);
    if (options.shouldLinkContracts) {
      console.log("\nPhase 2: Contract Integration");
      await linkContracts(registry, metadata);
    }
    if (options.testConnection) {
      console.log("\nPhase 3: Integration Testing");
      await testIntegration(registry, metadata);
    }
    console.log("\nPhase 4: Deployment Summary");
    await saveDeploymentInfo({
      registry,
      metadata,
      network: networkName,
      timestamp: new Date().toISOString()
    });
    console.log("\nTip: Verify contracts on the explorer (recommended):");
    console.log(`npx hardhat verify --network ${networkName} ${await registry.getAddress()}`);
    console.log(`npx hardhat verify --network ${networkName} ${await metadata.getAddress()}`);
  } catch (error: any) {
    console.error("❌ Deployment failed:", error.message);
    throw error;
  }
}


