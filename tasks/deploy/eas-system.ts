import { task } from "hardhat/config";
import { getDeployerSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";
import { logDeployment, getTimestamp } from "../shared/deployment-logger";

task("deploy-eas-system", "Deploy EAS SchemaRegistry and EAS contracts")
  .addOptionalParam("confirmations", "Number of block confirmations to wait for", undefined)
  .setAction(async (taskArgs, hre) => {
    console.log("Deploying EAS System (SchemaRegistry + EAS)...");

    const { signer, address: deployerAddress, method } = await getDeployerSigner(hre);
    console.log(`Deployer address: ${deployerAddress} (${method})`);

    // Determine confirmations
    const networkName = hre.network.name;
    const defaultConfirmations = ["localhost", "hardhat"].includes(networkName) ? 1 :
      networkName.toLowerCase().includes("testnet") ? 1 : 5;
    const confirmations = taskArgs.confirmations ? parseInt(taskArgs.confirmations) : defaultConfirmations;
    console.log(`Network: ${networkName}, Confirmations: ${confirmations}`);

    // Deploy SchemaRegistry
    console.log("\n📋 Step 1: Deploying SchemaRegistry...");
    const SchemaRegistry = await hre.ethers.getContractFactory("deps/eas/SchemaRegistry.sol:SchemaRegistry", signer);
    await logTransactionForVerification(hre, SchemaRegistry, "SchemaRegistry");
    const schemaRegistry = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const schemaRegistryAddress = await schemaRegistry.getAddress();
    console.log(`✅ SchemaRegistry deployed to: ${schemaRegistryAddress}`);
    await verifyBytecode(hre, schemaRegistryAddress, "SchemaRegistry");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await schemaRegistry.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    // Deploy EAS
    console.log("\n📋 Step 2: Deploying EAS...");
    const EAS = await hre.ethers.getContractFactory("deps/eas/EAS.sol:EAS", signer);
    console.log(`Constructor args: schemaRegistry=${schemaRegistryAddress}`);
    await logTransactionForVerification(hre, EAS, "EAS");
    const eas = await EAS.deploy(schemaRegistryAddress);
    await eas.waitForDeployment();
    const easAddress = await eas.getAddress();
    console.log(`✅ EAS deployed to: ${easAddress}`);
    await verifyBytecode(hre, easAddress, "EAS");

    // Wait for confirmations
    console.log(`Waiting for ${confirmations} block confirmation(s)...`);
    await eas.deploymentTransaction()!.wait(confirmations);
    console.log(`✅ Confirmed after ${confirmations} block(s)`);

    console.log("\n📝 Summary:");
    console.log(`Network: ${networkName}`);
    console.log(`Deployer address: ${deployerAddress}`);
    console.log(`SchemaRegistry: ${schemaRegistryAddress}`);
    console.log(`EAS: ${easAddress}`);

    // Note: EAS contracts are not part of the standard DeploymentRecord
    // They should be manually added to hardhat.config.ts NETWORK_CONTRACTS
    console.log("\n📝 Deployment complete - addresses logged above");

    console.log("\n⚠️  IMPORTANT: Update contract addresses in THREE locations:");
    console.log("\n1. app-registry-evm-solidity/hardhat.config.ts:");
    console.log(`   NETWORK_CONTRACTS.${networkName}.easSchemaRegistry = "${schemaRegistryAddress}"`);
    console.log(`   NETWORK_CONTRACTS.${networkName}.easContract = "${easAddress}"`);
    console.log("\n2. rep-attestation-tools-evm-solidity/hardhat.config.ts:");
    console.log(`   EAS_SCHEMA_REGISTRY_ADDRESSES.${networkName} = "${schemaRegistryAddress}"`);
    console.log(`   EAS_CONTRACT_ADDRESSES.${networkName} = "${easAddress}"`);
    console.log("\n3. rep-attestation-frontend/src/config/attestation-services.ts:");
    console.log(`   EAS_CONFIG.contracts[66238] = "${easAddress}"  // for omachainTestnet`);
    console.log("\n⚠️  Next steps:");
    console.log("\n1. Test the deployment:");
    console.log(`   npx hardhat eas-sanity --network ${networkName}`);
    console.log("\n2. Deploy all OMA3 reputation schemas:");
    console.log(`   See: ../rep-attestation-tools-evm-solidity/README.md`);
    console.log(`   cd ../rep-attestation-tools-evm-solidity`);
    console.log(`   npx hardhat generate-eas-object --schema schemas-json/endorsement.schema.json --network ${networkName}`);
    console.log(`   npx hardhat deploy-eas-schema --file generated/Endorsement.eastest.json --network ${networkName}`);
    console.log(`   # Repeat for all schemas: certification, security-assessment, user-review, etc.`);
    console.log("\n3. Update frontend with new schema UIDs:");
    console.log(`   cd ../rep-attestation-frontend`);
    console.log(`   node scripts/update-schemas.js ../rep-attestation-tools-evm-solidity`);
    console.log("\n4. (Optional) Deploy custom resolvers:");
    console.log(`   // RateLimitResolver, GaslessSchemaResolver, etc.`);
  });
