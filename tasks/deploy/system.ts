import { task } from "hardhat/config";
import type { Signer } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";

interface DeploymentResult {
  registry: any;
  metadata: any;
  resolver: any;
  network: string;
  timestamp: string;
}

/**
 * Determine smart default confirmations based on network type
 * - Local networks (hardhat, localhost): 1 confirmation
 * - Testnets (low activity, optimistic rollups): 1 confirmation
 * - Production networks: 5+ confirmations
 */
function getDefaultConfirmations(networkName: string): number {
  // Local development
  if (["localhost", "hardhat"].includes(networkName)) {
    return 1;
  }
  
  // Testnets (including OMA testnet, optimistic rollups, etc.)
  const testnetPatterns = [
    "testnet", "alfajores", "goerli", "sepolia", "mumbai", 
    "fuji", "optimism-goerli", "arbitrum-goerli", "base-goerli"
  ];
  if (testnetPatterns.some(pattern => networkName.toLowerCase().includes(pattern))) {
    return 1;
  }
  
  // Production networks - higher confirmations for security
  return 5;
}

async function deployRegistry(hre: HardhatRuntimeEnvironment, signer: Signer, confirmations: number): Promise<any> {
  console.log("Deploying OMA3AppRegistry...");
  try {
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry", signer);
    await logTransactionForVerification(hre, OMA3AppRegistry, "OMA3AppRegistry");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    const address = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3AppRegistry");
    
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await registry.deploymentTransaction()?.wait(confirmations);
    return registry;
  } catch (error: any) {
    console.error("❌ Registry deployment failed:", error.message);
    throw error;
  }
}

async function deployMetadata(hre: HardhatRuntimeEnvironment, signer: Signer, confirmations: number): Promise<any> {
  console.log("Deploying OMA3AppMetadata...");
  try {
    const OMA3AppMetadata = await hre.ethers.getContractFactory("OMA3AppMetadata", signer);
    await logTransactionForVerification(hre, OMA3AppMetadata, "OMA3AppMetadata");
    const metadata = await OMA3AppMetadata.deploy();
    await metadata.waitForDeployment();
    const address = await metadata.getAddress();
    console.log(`✅ OMA3AppMetadata deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3AppMetadata");
    
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await metadata.deploymentTransaction()?.wait(confirmations);
    return metadata;
  } catch (error: any) {
    console.error("❌ Metadata deployment failed:", error.message);
    throw error;
  }
}

async function deployResolver(hre: HardhatRuntimeEnvironment, signer: Signer, confirmations: number): Promise<any> {
  console.log("Deploying OMA3ResolverWithStore...");
  try {
    const OMA3ResolverWithStore = await hre.ethers.getContractFactory("OMA3ResolverWithStore", signer);
    await logTransactionForVerification(hre, OMA3ResolverWithStore, "OMA3ResolverWithStore");
    const resolver = await OMA3ResolverWithStore.deploy();
    await resolver.waitForDeployment();
    const address = await resolver.getAddress();
    console.log(`✅ OMA3ResolverWithStore deployed to: ${address}`);
    await verifyBytecode(hre, address, "OMA3ResolverWithStore");
    
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

async function testIntegration(registry: any, metadata: any, resolver: any): Promise<boolean> {
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
      return true;
    } else {
      console.log("❌ Integration test FAILED - contracts not properly linked");
      return false;
    }
  } catch (error: any) {
    console.log("❌ Integration test FAILED:", error.message);
    return false;
  }
}

async function saveDeploymentInfo(
  result: DeploymentResult, 
  deployerAddress: string, 
  chainId: number, 
  confirmations: number,
  integrationTestsPassed?: boolean
): Promise<void> {
  const { registry, metadata, resolver, network, timestamp } = result;
  const registryAddress = await registry.getAddress();
  const metadataAddress = await metadata.getAddress();
  const resolverAddress = await resolver.getAddress();
  
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("==============================");
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`OMA3AppRegistry contract address: ${registryAddress}`);
  console.log(`OMA3AppMetadata contract address: ${metadataAddress}`);
  console.log(`OMA3ResolverWithStore contract address: ${resolverAddress}`);
  console.log("==============================");
  console.log("\nEnvironment Variables:");
  console.log(`export APP_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`export APP_METADATA_ADDRESS=${metadataAddress}`);
  console.log(`export APP_RESOLVER_ADDRESS=${resolverAddress}`);

  // Log deployment to file
  await logDeployment({
    network,
    chainId,
    deployer: deployerAddress,
    registry: registryAddress,
    metadata: metadataAddress,
    resolver: resolverAddress,
    timestamp,
    blockConfirmations: confirmations,
    isSystemDeployment: true,
    integrationTestsPassed
  });

  console.log("\nNext Steps:");
  console.log("1. Set the environment variables above");
  console.log("2. Update hardhat.config.ts NETWORK_CONTRACTS");
  console.log("3. Update frontend src/config/chains.ts");
  console.log("4. Authorize issuers: npx hardhat resolver-add-issuer --network <network> --issuer <address>");
  console.log("\nExample usage:");
  console.log(`npx hardhat get-apps --network ${network}`);
  console.log(`npx hardhat get-metadata-json --did "did:oma3:example" --network ${network}`);
}

task("deploy-system", "Deploy the OMATrust App Registry + Metadata + Resolver system (development only - use Thirdweb Dashboard for production)")
  .addFlag("noLink", "Skip linking Registry, Metadata, and Resolver contracts")
  .addFlag("noTest", "Skip integration test after deployment (default is to test)")
  .addOptionalParam("confirmations", "Number of block confirmations to wait (default: 1 for testnets, 5 for mainnet)", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Note: This is for development/testing only.");
    console.log("For production deployment, use Thirdweb Dashboard for maximum security.");
    
    const networkName = hre.network.name;
    const isProductionNetwork = ["celo", "mainnet", "ethereum", "polygon", "arbitrum", "base"].includes(networkName);
    
    // Determine confirmations: use flag value if provided, otherwise use smart default
    const confirmations = taskArgs.confirmations 
      ? parseInt(taskArgs.confirmations) 
      : getDefaultConfirmations(networkName);
    
    console.log(`\nDeploying OMA3 Application System to: ${networkName}`);
    console.log(`Mode: ${isProductionNetwork ? "PRODUCTION" : "DEVELOPMENT"}`);
    console.log(`Block confirmations: ${confirmations}`);
    console.log(`Link contracts: ${!Boolean(taskArgs.noLink) ? "YES" : "NO"}`);
    console.log(`Test integration: ${!Boolean(taskArgs.noTest) ? "YES" : "NO"}`);
    console.log(`Security: SSH Key (development only)`);

    try {
      const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
      console.log(`Deployer address: ${deployerAddress} (${method})`);
      console.log("\nPhase 1: Secure Contract Deployment");
      const registry = await deployRegistry(hre, signer, confirmations);
      const metadata = await deployMetadata(hre, signer, confirmations);
      const resolver = await deployResolver(hre, signer, confirmations);
      
      if (!Boolean(taskArgs.noLink)) {
        console.log("\nPhase 2: Contract Integration");
        await linkContracts(registry, metadata, resolver);
      }
      let integrationTestsPassed: boolean | undefined = undefined;
      if (!Boolean(taskArgs.noTest)) {
        console.log("\nPhase 3: Integration Testing");
        integrationTestsPassed = await testIntegration(registry, metadata, resolver);
      }
      console.log("\nPhase 4: Deployment Summary");
      const chainId = (await hre.ethers.provider.getNetwork()).chainId as any as number;
      await saveDeploymentInfo(
        {
          registry,
          metadata,
          resolver,
          network: networkName,
          timestamp: getTimestamp()
        },
        deployerAddress,
        chainId,
        confirmations,
        integrationTestsPassed
      );
    } catch (error: any) {
      console.error("❌ Deployment failed:", error.message);
      throw error;
    }
  });