import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the maximum TTL in the resolver
 * 
 * Max TTL is the maximum time-to-live (in seconds) for attestations.
 * 
 * Usage:
 *   npx hardhat resolver-set-max-ttl \
 *     --duration 63072000 \
 *     --network omachainTestnet
 */
task("resolver-set-max-ttl", "Set maximum TTL in resolver")
  .addParam("duration", "Maximum TTL in seconds")
  .addOptionalParam("resolver", "Resolver contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { duration } = taskArgs;
    
    console.log(`\n🔧 Setting Maximum TTL on ${hre.network.name}`);
    
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
    
    // Get current max TTL
    const currentMaxTTL = await Resolver.maxTTLSeconds();
    console.log(`Current max TTL: ${currentMaxTTL} seconds`);
    
    if (currentMaxTTL.toString() === duration) {
      console.log("⚠️  Max TTL is already set to this value");
      return;
    }
    
    // Set max TTL
    console.log(`Setting max TTL to ${durationSeconds} seconds...`);
    const tx = await Resolver.setMaxTTL(durationSeconds);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newMaxTTL = await Resolver.maxTTLSeconds();
    if (newMaxTTL.toString() === duration) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
