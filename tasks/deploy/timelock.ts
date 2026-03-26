import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { getTimestamp, getOpenZeppelinVersion } from "../shared/deployment-logger";

task("deploy-timelock", "Deploy OpenZeppelin TimelockController")
  .addParam("proposer", "Address with proposer and executor roles (admin server wallet)")
  .addOptionalParam("delay", "Minimum delay in seconds (default: 432000 for mainnet, 86400 otherwise)")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying TimelockController...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    const networkName = hre.network.name;
    const MAINNET_NETWORKS = ['omachainMainnet'];
    const isMainnet = MAINNET_NETWORKS.includes(networkName);
    const defaultDelay = isMainnet ? 432000 : 86400;
    const minDelay = taskArgs.delay ? parseInt(taskArgs.delay) : defaultDelay;

    if (isMainnet && minDelay < 432000) {
      console.warn(`⚠️  WARNING: Mainnet delay is ${minDelay}s (${minDelay / 3600}h) — less than the recommended 5 days (432000s).`);
    }
    const proposer = taskArgs.proposer;
    console.log(`Min delay: ${minDelay} seconds (${minDelay / 3600}h)`);
    console.log(`Proposer/Executor: ${proposer}`);
    console.log(`Admin: address(0) — roles managed by timelock itself`);

    // Determine confirmations
    const TESTNET_NETWORKS = ['omachainTestnet'];
    const defaultConfirmations = ["localhost", "hardhat"].includes(networkName) ? 1 :
                                 TESTNET_NETWORKS.includes(networkName) ? 1 : 5;
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    console.log(`Network: ${networkName}, Confirmations: ${confirmations}`);

    // Deploy
    const TimelockController = await hre.ethers.getContractFactory("TimelockController", signer);
    await logTransactionForVerification(hre, TimelockController, "TimelockController");
    console.log("Deploying TimelockController...");

    const timelock = await TimelockController.deploy(
      minDelay,                                    // minDelay
      [proposer],                                  // proposers
      [proposer],                                  // executors
      "0x0000000000000000000000000000000000000000"  // admin = address(0)
    );
    await timelock.waitForDeployment();
    const contractAddress = await timelock.getAddress();
    console.log(`✅ TimelockController deployed to: ${contractAddress}`);
    await verifyBytecode(hre, contractAddress, "TimelockController");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await timelock.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    console.log("\n📝 Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer: ${deployerAddress}`);
    console.log(`TimelockController: ${contractAddress}`);
    console.log(`Min delay: ${minDelay}s (${minDelay / 3600}h)`);
    console.log(`Proposer: ${proposer}`);
    console.log(`Executor: ${proposer}`);

    // Log deployment to file
    // TODO: Refactor to use shared logDeployment() from tasks/shared/deployment-logger.ts
    // See ISSUE-auto-update-active-deployments.md
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    const filePath = require('path').join(process.cwd(), 'contract-addresses.txt');
    const fs = require('fs');
    let existingContent = '';
    try { existingContent = fs.readFileSync(filePath, 'utf-8'); } catch {}
    const deploymentMatches = existingContent.match(/=== Deployment #(\d+) ===/g) || [];
    const deploymentNumber = deploymentMatches.length + 1;

    let entry = `\n=== Deployment #${deploymentNumber} ===\n`;
    entry += `Timestamp: ${getTimestamp()}\n`;
    entry += `Network: ${networkName} (Chain ID: ${chainId})\n`;
    entry += `Type: TimelockController\n`;
    entry += `Method: Hardhat (SSH Key)\n`;
    entry += `Deployer: ${deployerAddress}\n\n`;
    entry += `Deployed Contracts:\n`;
    entry += `  TimelockController: ${contractAddress}\n\n`;
    entry += `Configuration:\n`;
    entry += `  Min Delay: ${minDelay}s (${minDelay / 3600}h)\n`;
    entry += `  Proposer:  ${proposer}\n`;
    entry += `  Executor:  ${proposer}\n`;
    entry += `  Admin:     address(0)\n`;
    entry += `\nDeployment Details:\n`;
    entry += `  Block Confirmations: ${confirmations}\n`;
    entry += `  OpenZeppelin Contracts: v${getOpenZeppelinVersion()}\n`;
    entry += `  Verification Status: Pending\n`;
    entry += `============================================================================\n`;

    try {
      fs.appendFileSync(filePath, entry, 'utf-8');
      console.log(`\n✅ Deployment logged to contract-addresses.txt (Deployment #${deploymentNumber})`);
    } catch (error) {
      console.error(`❌ Failed to log deployment:`, error);
    }

    console.log("\n⚠️  Next steps:");
    console.log("1. Update contract-addresses.txt active deployment section with the timelock address");
    console.log("2. Update oma3-ops/src/admin-wallet/config.ts with the timelock address");
    console.log("3. Transfer contract ownership to the timelock:");
    console.log(`   npx hardhat registry-transfer-owner --network ${networkName} --new-owner ${contractAddress}`);
    console.log(`   npx hardhat metadata-transfer-owner --network ${networkName} --new-owner ${contractAddress}`);
    console.log(`   npx hardhat resolver-transfer-owner --network ${networkName} --new-owner ${contractAddress}`);
    console.log("4. Add attestation wallet as issuer via timelock (see OMA3-Ops admin scripts)");
  });
