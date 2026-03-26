import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the ownership resolver address in the registry
 * 
 * Usage:
 *   npx hardhat registry-set-ownership-resolver \
 *     --resolver 0xe4E8FBf35b6f4D975B4334ffAfaEfd0713217cAb \
 *     --network omachainTestnet
 */
task("registry-set-ownership-resolver", "Set ownership resolver in registry")
  .addParam("resolver", "Resolver contract address")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { resolver } = taskArgs;
    
    console.log(`\n🔧 Setting Ownership Resolver on ${hre.network.name}`);
    
    // Validate resolver address
    if (!hre.ethers.isAddress(resolver)) {
      throw new Error(`Invalid resolver address: ${resolver}`);
    }
    
    // Get registry address
    const registryAddress = taskArgs.registry || getNetworkContractAddress(hre, "registry");
    console.log(`Registry: ${registryAddress}`);
    console.log(`Resolver: ${resolver}\n`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, registryAddress, "OMA3AppRegistry");
    
    // Get registry contract
    const Registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress, signer);
    
    // Get current ownership resolver
    const currentResolver = await Registry.ownershipResolver();
    console.log(`Current resolver: ${currentResolver}`);
    
    if (currentResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("⚠️  Ownership resolver is already set to this address");
      return;
    }
    
    // Set ownership resolver
    console.log("Setting ownership resolver...");
    const tx = await Registry.setOwnershipResolver(resolver);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newResolver = await Registry.ownershipResolver();
    if (newResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
