import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the maturation time in the resolver
 * 
 * Maturation time is how long (in seconds) before ownership changes take effect.
 * 
 * Usage:
 *   npx hardhat resolver-set-maturation \
 *     --duration 3600 \
 *     --network omachainTestnet
 */
task("resolver-set-maturation", "Set maturation time in resolver")
  .addParam("duration", "Maturation time in seconds")
  .addOptionalParam("resolver", "Resolver contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { duration } = taskArgs;
    
    console.log(`\n🔧 Setting Maturation Time on ${hre.network.name}`);
    
    // Parse and validate duration
    const durationSeconds = parseInt(duration);
    if (isNaN(durationSeconds) || durationSeconds < 0) {
      throw new Error(`Invalid duration: ${duration}`);
    }
    
    // Get resolver address
    const resolverAddress = taskArgs.resolver || getNetworkContractAddress(hre, "resolver");
    console.log(`Resolver: ${resolverAddress}`);
    console.log(`Duration: ${durationSeconds} seconds\n`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, resolverAddress, "OMA3ResolverWithStore");
    
    // Get resolver contract
    const Resolver = await hre.ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, signer);
    
    // Get current maturation time
    const currentMaturation = await Resolver.maturationSeconds();
    console.log(`Current maturation: ${currentMaturation} seconds`);
    
    if (currentMaturation.toString() === duration) {
      console.log("⚠️  Maturation time is already set to this value");
      return;
    }
    
    // Set maturation time
    console.log(`Setting maturation time to ${durationSeconds} seconds...`);
    const tx = await Resolver.setMaturation(durationSeconds);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newMaturation = await Resolver.maturationSeconds();
    if (newMaturation.toString() === duration) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
