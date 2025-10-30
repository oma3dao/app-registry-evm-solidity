import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the registration resolver address in the registry
 * 
 * Usage:
 *   npx hardhat registry-set-registration-resolver \
 *     --resolver 0xe4E8FBf35b6f4D975B4334ffAfaEfd0713217cAb \
 *     --network omachainTestnet
 */
task("registry-set-registration-resolver", "Set registration resolver in registry")
  .addParam("resolver", "Resolver contract address")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { resolver } = taskArgs;
    
    console.log(`\n🔧 Setting Registration Resolver on ${hre.network.name}`);
    
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
    
    // Get current registration resolver
    const currentResolver = await Registry.registrationResolver();
    console.log(`Current resolver: ${currentResolver}`);
    
    if (currentResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("⚠️  Registration resolver is already set to this address");
      return;
    }
    
    // Set registration resolver
    console.log("Setting registration resolver...");
    const tx = await Registry.setRegistrationResolver(resolver);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newResolver = await Registry.registrationResolver();
    if (newResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
