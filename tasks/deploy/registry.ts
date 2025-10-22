import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";

task("deploy-registry", "Deploy only the OMATrust App Registry contract (development only - use Thirdweb Dashboard for production)")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying OMA3AppRegistry contract...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    // Determine confirmations
    const networkName = hre.network.name;
    const defaultConfirmations = ["localhost", "hardhat"].includes(networkName) ? 1 : 
                                 networkName.toLowerCase().includes("testnet") ? 1 : 5;
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    console.log(`Network: ${networkName}, Confirmations: ${confirmations}`);

    // Deploy
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry", signer);
    await logTransactionForVerification(hre, OMA3AppRegistry, "OMA3AppRegistry");
    console.log("Deploying OMA3AppRegistry...");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    const contractAddress = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${contractAddress}`);
    await verifyBytecode(hre, contractAddress, "OMA3AppRegistry");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await registry.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    console.log("\n📝 Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer address: ${deployerAddress}`);
    console.log(`OMA3AppRegistry contract address: ${contractAddress}`);

    // Log deployment to file
    await logDeployment({
      network: networkName,
      chainId: (await hre.ethers.provider.getNetwork()).chainId as any as number,
      deployer: deployerAddress,
      registry: contractAddress,
      timestamp: getTimestamp(),
      blockConfirmations: confirmations,
      isSystemDeployment: false
    });

    console.log("\n⚠️  Next steps:");
    console.log("1. Update contract-addresses.txt active deployment section with this new registry address");
    console.log("2. Update hardhat.config.ts NETWORK_CONTRACTS with this registry address");
    console.log("3. Update frontend src/config/chains.ts with this registry address");
    console.log("\n4. Configure registry to use metadata contract:");
    console.log(`   npx hardhat registry-set-metadata-contract --network ${networkName} --metadata <METADATA_ADDRESS>`);
    console.log("\n5. Authorize this registry on the metadata contract:");
    console.log(`   npx hardhat metadata-authorize-registry --network ${networkName} --registry ${contractAddress}`);
    console.log("\n6. Configure registry to use resolver:");
    console.log(`   npx hardhat registry-set-ownership-resolver --network ${networkName} --resolver <RESOLVER_ADDRESS>`);
    console.log(`   npx hardhat registry-set-dataurl-resolver --network ${networkName} --resolver <RESOLVER_ADDRESS>`);
  });


