import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the metadata contract address in the registry
 * 
 * Usage:
 *   npx hardhat registry-set-metadata-contract \
 *     --metadata 0x13aD113D0DE923Ac117c82401e9E1208F09D7F19 \
 *     --network omachainTestnet
 */
task("registry-set-metadata-contract", "Set metadata contract in registry")
  .addParam("metadata", "Metadata contract address")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { metadata } = taskArgs;
    
    console.log(`\n🔧 Setting Metadata Contract on ${hre.network.name}`);
    
    // Validate metadata address
    if (!hre.ethers.isAddress(metadata)) {
      throw new Error(`Invalid metadata address: ${metadata}`);
    }
    
    // Get registry address
    const registryAddress = taskArgs.registry || getNetworkContractAddress(hre, "registry");
    console.log(`Registry: ${registryAddress}`);
    console.log(`Metadata: ${metadata}\n`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, registryAddress, "OMA3AppRegistry");
    
    // Get registry contract
    const Registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress, signer);
    
    // Get current metadata contract
    const currentMetadata = await Registry.metadataContract();
    console.log(`Current metadata: ${currentMetadata}`);
    
    if (currentMetadata.toLowerCase() === metadata.toLowerCase()) {
      console.log("⚠️  Metadata contract is already set to this address");
      return;
    }
    
    // Set metadata contract
    console.log("Setting metadata contract...");
    const tx = await Registry.setMetadataContract(metadata);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newMetadata = await Registry.metadataContract();
    if (newMetadata.toLowerCase() === metadata.toLowerCase()) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
