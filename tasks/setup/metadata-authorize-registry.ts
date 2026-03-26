import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the authorized registry address in the metadata contract
 * 
 * Usage:
 *   npx hardhat metadata-authorize-registry \
 *     --registry 0xb493465Bcb2151d5b5BaD19d87f9484c8B8A8e83 \
 *     --network omachainTestnet
 */
task("metadata-authorize-registry", "Authorize registry in metadata contract")
  .addParam("registry", "Registry contract address to authorize")
  .addOptionalParam("metadata", "Metadata contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { registry } = taskArgs;
    
    console.log(`\n🔧 Authorizing Registry on ${hre.network.name}`);
    
    // Validate registry address
    if (!hre.ethers.isAddress(registry)) {
      throw new Error(`Invalid registry address: ${registry}`);
    }
    
    // Get metadata address
    const metadataAddress = taskArgs.metadata || getNetworkContractAddress(hre, "metadata");
    console.log(`Metadata: ${metadataAddress}`);
    console.log(`Registry: ${registry}\n`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, metadataAddress, "OMA3AppMetadata");
    
    // Get metadata contract
    const Metadata = await hre.ethers.getContractAt("OMA3AppMetadata", metadataAddress, signer);
    
    // Get current authorized registry
    const currentRegistry = await Metadata.authorizedRegistry();
    console.log(`Current authorized registry: ${currentRegistry}`);
    
    if (currentRegistry.toLowerCase() === registry.toLowerCase()) {
      console.log("⚠️  Registry is already authorized");
      return;
    }
    
    // Authorize registry
    console.log("Authorizing registry...");
    const tx = await Metadata.setAuthorizedRegistry(registry);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newRegistry = await Metadata.authorizedRegistry();
    if (newRegistry.toLowerCase() === registry.toLowerCase()) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
