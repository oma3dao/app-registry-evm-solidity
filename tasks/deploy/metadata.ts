import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";

task("deploy-metadata", "Deploy only the OMA3 App Metadata contract")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying OMA3AppMetadata contract...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    // Determine confirmations
    const networkName = hre.network.name;
    const defaultConfirmations = ["localhost", "hardhat"].includes(networkName) ? 1 : 
                                 networkName.toLowerCase().includes("testnet") ? 1 : 5;
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    console.log(`Network: ${networkName}, Confirmations: ${confirmations}`);

    // Deploy
    const OMA3AppMetadata = await hre.ethers.getContractFactory("OMA3AppMetadata", signer);
    await logTransactionForVerification(hre, OMA3AppMetadata, "OMA3AppMetadata");
    console.log("Deploying OMA3AppMetadata...");
    const metadata = await OMA3AppMetadata.deploy();
    await metadata.waitForDeployment();
    const contractAddress = await metadata.getAddress();
    console.log(`✅ OMA3AppMetadata deployed to: ${contractAddress}`);
    await verifyBytecode(hre, contractAddress, "OMA3AppMetadata");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await metadata.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    console.log("\n📝 Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer address: ${deployerAddress}`);
    console.log(`OMA3AppMetadata contract address: ${contractAddress}`);

    // Log deployment to file
    await logDeployment({
      network: networkName,
      chainId: (await hre.ethers.provider.getNetwork()).chainId as any as number,
      deployer: deployerAddress,
      metadata: contractAddress,
      timestamp: getTimestamp(),
      blockConfirmations: confirmations,
      isSystemDeployment: false
    });

    console.log("\n⚠️  Next steps:");
    console.log("1. Update hardhat.config.ts NETWORK_CONTRACTS");
    console.log("2. Update frontend src/config/chains.ts");
  });
