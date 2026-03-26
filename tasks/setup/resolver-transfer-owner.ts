import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Transfer ownership of the resolver contract
 * 
 * Usage:
 *   npx hardhat resolver-transfer-owner \
 *     --new-owner 0x1234... \
 *     --network omachainTestnet
 */
task("resolver-transfer-owner", "Transfer resolver ownership")
  .addParam("newOwner", "New owner address")
  .addOptionalParam("resolver", "Resolver contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { newOwner } = taskArgs;
    
    console.log(`\n🔧 Transferring Resolver Ownership on ${hre.network.name}`);
    
    // Validate new owner address
    if (!hre.ethers.isAddress(newOwner)) {
      throw new Error(`Invalid new owner address: ${newOwner}`);
    }
    
    // Get resolver address
    const resolverAddress = taskArgs.resolver || getNetworkContractAddress(hre, "resolver");
    console.log(`Resolver: ${resolverAddress}`);
    console.log(`New Owner: ${newOwner}\n`);
    
    // Get signer and verify ownership
    const { signer, address: signerAddress } = await getSignerAndCheckOwnership(hre, resolverAddress, "OMA3ResolverWithStore");
    
    if (signerAddress.toLowerCase() === newOwner.toLowerCase()) {
      console.log("⚠️  New owner is the same as current owner");
      return;
    }
    
    console.log("⚠️  WARNING: You are about to transfer ownership!");
    console.log("⚠️  After this transaction, you will no longer be able to manage the resolver.");
    console.log("⚠️  Make sure the new owner address is correct.\n");
    
    // Get resolver contract
    const Resolver = await hre.ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, signer);
    
    // Transfer ownership
    console.log("Transferring ownership...");
    const tx = await Resolver.transferOwnership(newOwner);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const currentOwner = await Resolver.owner();
    if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
      console.log("✅ Ownership transferred successfully");
      console.log(`New owner: ${currentOwner}`);
    } else {
      throw new Error("Verification failed");
    }
  });
