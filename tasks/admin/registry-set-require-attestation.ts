import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Enable or disable the dataUrl attestation requirement in the registry
 * 
 * Usage:
 *   # Enable attestation requirement
 *   npx hardhat registry-set-require-attestation \
 *     --require true \
 *     --network omachainTestnet
 * 
 *   # Disable attestation requirement (default for testing)
 *   npx hardhat registry-set-require-attestation \
 *     --require false \
 *     --network omachainTestnet
 */
task("registry-set-require-attestation", "Enable/disable dataUrl attestation requirement in registry")
  .addParam("require", "True to require attestations, false to disable (accepts: true, false, 1, 0)")
  .addOptionalParam("registry", "Registry contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const requireParam = taskArgs.require;
    
    // Parse the boolean parameter (accepts true/false or 1/0)
    let requireAttestation: boolean;
    if (requireParam === 'true' || requireParam === '1' || requireParam === true) {
      requireAttestation = true;
    } else if (requireParam === 'false' || requireParam === '0' || requireParam === false) {
      requireAttestation = false;
    } else {
      throw new Error(`Invalid --require value: ${requireParam}. Use: true, false, 1, or 0`);
    }
    
    console.log(`\n🔧 Setting DataUrl Attestation Requirement on ${hre.network.name}`);
    console.log(`Setting to: ${requireAttestation ? 'ENABLED (require attestations)' : 'DISABLED (no attestations required)'}\n`);
    
    // Get registry address
    const registryAddress = taskArgs.registry || getNetworkContractAddress(hre, "registry");
    console.log(`Registry: ${registryAddress}`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, registryAddress, "OMA3AppRegistry");
    
    // Get registry contract
    const Registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress, signer);
    
    // Get current setting
    const currentSetting = await Registry.requireDataUrlAttestation();
    console.log(`Current setting: ${currentSetting ? 'ENABLED' : 'DISABLED'}`);
    
    if (currentSetting === requireAttestation) {
      console.log(`⚠️  Attestation requirement is already ${requireAttestation ? 'enabled' : 'disabled'}`);
      return;
    }
    
    // Get current resolver address for context
    const resolverAddress = await Registry.dataUrlResolver();
    console.log(`DataUrl Resolver: ${resolverAddress}`);
    
    if (requireAttestation && resolverAddress === hre.ethers.ZeroAddress) {
      console.log("\n⚠️  WARNING: Enabling attestation requirement but no resolver is set!");
      console.log("Apps will not be able to mint until a resolver is configured.");
      console.log("Set resolver first using: npx hardhat registry-set-dataurl-resolver");
    }
    
    // Set the flag
    console.log(`\n${requireAttestation ? 'Enabling' : 'Disabling'} attestation requirement...`);
    const tx = await Registry.setRequireDataUrlAttestation(requireAttestation);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const newSetting = await Registry.requireDataUrlAttestation();
    if (newSetting === requireAttestation) {
      console.log("✅ Verification successful");
      console.log(`\nDataUrl attestation requirement is now: ${newSetting ? 'ENABLED' : 'DISABLED'}`);
      
      if (newSetting) {
        console.log("\n📋 Apps must now have dataHash attestations from the resolver to be minted.");
      } else {
        console.log("\n📋 Apps can now be minted without dataHash attestations (for testing/development).");
      }
    } else {
      throw new Error("Verification failed");
    }
  });

