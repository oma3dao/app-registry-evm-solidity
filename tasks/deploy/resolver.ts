import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";

task("deploy-resolver", "Deploy only the OMA3 Resolver contract")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying OMA3ResolverWithStore contract...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    // Determine confirmations
    const networkName = hre.network.name;
    const defaultConfirmations = ["localhost", "hardhat"].includes(networkName) ? 1 : 
                                 networkName.toLowerCase().includes("testnet") ? 1 : 5;
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    console.log(`Network: ${networkName}, Confirmations: ${confirmations}`);

    // Deploy
    const OMA3ResolverWithStore = await hre.ethers.getContractFactory("OMA3ResolverWithStore", signer);
    await logTransactionForVerification(hre, OMA3ResolverWithStore, "OMA3ResolverWithStore");
    console.log("Deploying OMA3ResolverWithStore...");
    const resolver = await OMA3ResolverWithStore.deploy();
    await resolver.waitForDeployment();
    const contractAddress = await resolver.getAddress();
    console.log(`✅ OMA3ResolverWithStore deployed to: ${contractAddress}`);
    await verifyBytecode(hre, contractAddress, "OMA3ResolverWithStore");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await resolver.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    console.log("\n📝 Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer address: ${deployerAddress}`);
    console.log(`OMA3ResolverWithStore contract address: ${contractAddress}`);

    // Log deployment to file
    await logDeployment({
      network: networkName,
      chainId: (await hre.ethers.provider.getNetwork()).chainId as any as number,
      deployer: deployerAddress,
      resolver: contractAddress,
      timestamp: getTimestamp(),
      blockConfirmations: confirmations,
      isSystemDeployment: false
    });

    console.log("\n⚠️  Next steps:");
    console.log("1. Update contract-addresses.txt active deployment section with this new resolver address");
    console.log("2. Update hardhat.config.ts NETWORK_CONTRACTS with this resolver address");
    console.log("3. Update frontend src/config/chains.ts with this resolver address");
    console.log("4. Configure resolver settings (optional):");
    console.log(`   # Set maturation period (e.g., 48 hours for production, 0 for dev)`);
    console.log(`   npx hardhat resolver-set-maturation --network ${networkName} --duration <SECONDS>`);
    console.log(`   `);
    console.log(`   # Set max TTL for attestations (e.g., 2 years)`);
    console.log(`   npx hardhat resolver-set-max-ttl --network ${networkName} --duration <SECONDS>`);
    console.log("\n5. Authorize attestation issuers and update contract-addresses.txt Issuers section:");
    console.log(`   npx hardhat resolver-add-issuer --network ${networkName} --issuer <ISSUER_ADDRESS>`);
  });
