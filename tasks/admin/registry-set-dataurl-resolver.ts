import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Set the data URL resolver address in the registry
 * 
 * Usage:
 *   npx hardhat registry-set-dataurl-resolver \
 *     --resolver 0xe4E8FBf35b6f4D975B4334ffAfaEfd0713217cAb \
 *     --network omachainTestnet
 */
task("registry-set-dataurl-resolver", "Set data URL resolver in registry")
  .addParam("resolver", "Resolver contract address")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { resolver } = taskArgs;
    
    console.log(`\n🔧 Setting Data URL Resolver on ${hre.network.name}`);
    
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
    
    // Get current data URL resolver
    const currentResolver = await Registry.dataUrlResolver();
    console.log(`Current resolver: ${currentResolver}`);
    
    if (currentResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("⚠️  Data URL resolver is already set to this address");
      return;
    }
    
    // Set data URL resolver
    console.log("Setting data URL resolver...");
    const tx = await Registry.setDataUrlResolver(resolver);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newResolver = await Registry.dataUrlResolver();
    if (newResolver.toLowerCase() === resolver.toLowerCase()) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
