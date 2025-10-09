import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Transfer ownership of the registry contract
 * 
 * Usage:
 *   npx hardhat registry-transfer-owner \
 *     --new-owner 0x1234... \
 *     --network omachainTestnet
 */
task("registry-transfer-owner", "Transfer registry ownership")
  .addParam("newOwner", "New owner address")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { newOwner } = taskArgs;
    
    console.log(`\n🔧 Transferring Registry Ownership on ${hre.network.name}`);
    
    // Validate new owner address
    if (!hre.ethers.isAddress(newOwner)) {
      throw new Error(`Invalid new owner address: ${newOwner}`);
    }
    
    // Get registry address
    const registryAddress = taskArgs.registry || getNetworkContractAddress(hre, "registry");
    console.log(`Registry: ${registryAddress}`);
    console.log(`New Owner: ${newOwner}\n`);
    
    // Get signer and verify ownership
    const { signer, address: signerAddress } = await getSignerAndCheckOwnership(hre, registryAddress, "OMA3AppRegistry");
    
    if (signerAddress.toLowerCase() === newOwner.toLowerCase()) {
      console.log("⚠️  New owner is the same as current owner");
      return;
    }
    
    console.log("⚠️  WARNING: You are about to transfer ownership!");
    console.log("⚠️  After this transaction, you will no longer be able to manage the registry.");
    console.log("⚠️  Make sure the new owner address is correct.\n");
    
    // Get registry contract
    const Registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress, signer);
    
    // Transfer ownership
    console.log("Transferring ownership...");
    const tx = await Registry.transferOwnership(newOwner);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const currentOwner = await Registry.owner();
    if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
      console.log("✅ Ownership transferred successfully");
      console.log(`New owner: ${currentOwner}`);
    } else {
      throw new Error("Verification failed");
    }
  });
