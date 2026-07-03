import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";
import * as fs from "fs";
import * as path from "path";

task("deploy-fee-resolver", "Deploy OMATrustFeeResolver for external chains with existing EAS")
  .addParam("eas", "EAS contract address on the target chain")
  .addParam("fee", "Attestation fee in ETH (e.g., '0.001')")
  .addParam("treasury", "Treasury address to receive fees (Gnosis Safe recommended)")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying OMATrustFeeResolver...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    // Parse parameters
    const easAddress = taskArgs.eas;
    const feeInWei = hre.ethers.parseEther(taskArgs.fee);
    const treasuryAddress = taskArgs.treasury;

    // Validate addresses
    if (!hre.ethers.isAddress(easAddress)) {
      throw new Error(`Invalid EAS address: ${easAddress}`);
    }
    if (!hre.ethers.isAddress(treasuryAddress)) {
      throw new Error(`Invalid treasury address: ${treasuryAddress}`);
    }

    // OMAChain: no reorg risk (single sequencer), finality from L1 settlement. Default to 1.
    const networkName = hre.network.name;
    const defaultConfirmations = 1; // Use --confirmations for chains with reorg risk (e.g., L1 Ethereum: 3+)
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    
    console.log(`\nNetwork: ${networkName}`);
    console.log(`EAS Contract: ${easAddress}`);
    console.log(`Fee: ${taskArgs.fee} ETH (${feeInWei.toString()} wei)`);
    console.log(`Treasury: ${treasuryAddress}`);
    console.log(`Confirmations: ${confirmations}`);

    // Deploy OMATrustFeeResolver
    console.log("\n📋 Deploying OMATrustFeeResolver...");
    const FeeResolver = await hre.ethers.getContractFactory(
      "contracts/reputation/OMATrustFeeResolver.sol:OMATrustFeeResolver",
      signer
    );
    
    await logTransactionForVerification(hre, FeeResolver, "OMATrustFeeResolver");
    const resolver = await FeeResolver.deploy(easAddress, feeInWei, treasuryAddress);
    await resolver.waitForDeployment();
    const resolverAddress = await resolver.getAddress();
    console.log(`✅ OMATrustFeeResolver deployed to: ${resolverAddress}`);
    
    await verifyBytecode(hre, resolverAddress, "OMATrustFeeResolver");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await resolver.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    // Verify deployment by reading back values
    console.log("\n🔍 Verifying deployment...");
    const deployedFee = await resolver.getFunction("fee")();
    const deployedRecipient = await resolver.getFunction("feeRecipient")();
    const resolverName = await resolver.getFunction("NAME")();
    const resolverVersion = await resolver.getFunction("VERSION")();
    
    console.log(`  NAME: ${resolverName}`);
    console.log(`  VERSION: ${resolverVersion}`);
    console.log(`  fee: ${hre.ethers.formatEther(deployedFee)} ETH`);
    console.log(`  feeRecipient: ${deployedRecipient}`);

    if (deployedFee !== feeInWei) {
      console.error("❌ Fee mismatch!");
    }
    if (deployedRecipient.toLowerCase() !== treasuryAddress.toLowerCase()) {
      console.error("❌ Treasury address mismatch!");
    }

    // Log deployment
    const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
    await logDeployment({
      network: networkName,
      chainId,
      deployer: deployerAddress,
      feeResolver: resolverAddress,
      timestamp: getTimestamp(),
      blockConfirmations: confirmations,
      isSystemDeployment: false,
      method: 'Hardhat (SSH Key)',
    });

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network:          ${networkName}`);
    console.log(`Resolver Address: ${resolverAddress}`);
    console.log(`Fee:              ${taskArgs.fee} ETH`);
    console.log(`Treasury:         ${treasuryAddress}`);
    console.log("=".repeat(60));

    console.log("\n⚠️  NEXT STEPS:");
    console.log("\n1. Deploy schemas with this resolver:");
    console.log(`   cd ../rep-attestation-tools-evm-solidity`);
    console.log(`   npx hardhat deploy-eas-schema --file generated/Endorsement.eas.json --resolver ${resolverAddress} --network ${networkName}`);
    console.log("\n2. Verify the contract on block explorer (if supported):");
    console.log(`   npx hardhat verify --network ${networkName} ${resolverAddress} "${easAddress}" "${feeInWei}" "${treasuryAddress}"`);

    return resolverAddress;
  });
