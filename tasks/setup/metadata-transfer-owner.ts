import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Transfer ownership of the metadata contract
 * 
 * Usage:
 *   npx hardhat metadata-transfer-owner \
 *     --new-owner 0x1234... \
 *     --network omachainTestnet
 */
task("metadata-transfer-owner", "Transfer metadata ownership")
  .addParam("newOwner", "New owner address")
  .addOptionalParam("metadata", "Metadata contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { newOwner } = taskArgs;
    
    console.log(`\n🔧 Transferring Metadata Ownership on ${hre.network.name}`);
    
    // Validate new owner address
    if (!hre.ethers.isAddress(newOwner)) {
      throw new Error(`Invalid new owner address: ${newOwner}`);
    }
    
    // Get metadata address
    const metadataAddress = taskArgs.metadata || getNetworkContractAddress(hre, "metadata");
    console.log(`Metadata: ${metadataAddress}`);
    console.log(`New Owner: ${newOwner}\n`);
    
    // Get signer and verify ownership
    const { signer, address: signerAddress } = await getSignerAndCheckOwnership(hre, metadataAddress, "OMA3AppMetadata");
    
    if (signerAddress.toLowerCase() === newOwner.toLowerCase()) {
      console.log("⚠️  New owner is the same as current owner");
      return;
    }
    
    console.log("⚠️  WARNING: You are about to transfer ownership!");
    console.log("⚠️  After this transaction, you will no longer be able to manage the metadata contract.");
    console.log("⚠️  Make sure the new owner address is correct.\n");
    
    // Get metadata contract
    const Metadata = await hre.ethers.getContractAt("OMA3AppMetadata", metadataAddress, signer);
    
    // Transfer ownership
    console.log("Transferring ownership...");
    const tx = await Metadata.transferOwnership(newOwner);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const currentOwner = await Metadata.owner();
    if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
      console.log("✅ Ownership transferred successfully");
      console.log(`New owner: ${currentOwner}`);
    } else {
      throw new Error("Verification failed");
    }
  });
