import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Remove an authorized attestation issuer from the resolver
 * 
 * Usage:
 *   npx hardhat resolver-remove-issuer \
 *     --issuer 0x1234... \
 *     --network omachainTestnet
 */
task("resolver-remove-issuer", "Remove authorized attestation issuer from resolver")
  .addParam("issuer", "Issuer address to remove")
  .addOptionalParam("resolver", "Resolver contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { issuer } = taskArgs;
    
    console.log(`\n🔧 Removing Authorized Issuer on ${hre.network.name}`);
    
    // Validate issuer address
    if (!hre.ethers.isAddress(issuer)) {
      throw new Error(`Invalid issuer address: ${issuer}`);
    }
    
    // Get resolver address
    const resolverAddress = taskArgs.resolver || getNetworkContractAddress(hre, "resolver");
    console.log(`Resolver: ${resolverAddress}`);
    console.log(`Issuer: ${issuer}\n`);
    
    // Get signer and verify ownership
    const { signer } = await getSignerAndCheckOwnership(hre, resolverAddress, "OMA3ResolverWithStore");
    
    // Get resolver contract
    const Resolver = await hre.ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, signer);
    
    // Check if currently authorized
    const isCurrentlyAuthorized = await Resolver.isIssuer(issuer);
    if (!isCurrentlyAuthorized) {
      console.log("⚠️  Address is not currently authorized");
      return;
    }
    
    // Remove issuer
    console.log("Removing authorized issuer...");
    const tx = await Resolver.removeAuthorizedIssuer(issuer);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const isStillAuthorized = await Resolver.isIssuer(issuer);
    if (!isStillAuthorized) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
