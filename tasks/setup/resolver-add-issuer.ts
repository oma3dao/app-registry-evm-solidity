import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getNetworkContractAddress } from "../shared/env-helpers";
import { getSignerAndCheckOwnership } from "../shared/signer-utils";

/**
 * Add an authorized attestation issuer to the resolver
 * 
 * Usage:
 *   npx hardhat resolver-add-issuer \
 *     --issuer 0x1234... \
 *     --network omachainTestnet
 */
task("resolver-add-issuer", "Add authorized attestation issuer to resolver")
  .addParam("issuer", "Issuer address to authorize")
  .addOptionalParam("resolver", "Resolver contract address (defaults to hardhat.config.ts)")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { issuer } = taskArgs;
    
    console.log(`\n🔧 Adding Authorized Issuer on ${hre.network.name}`);
    
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
    
    // Check if already authorized
    const isAlreadyAuthorized = await Resolver.isIssuer(issuer);
    if (isAlreadyAuthorized) {
      console.log("⚠️  Address is already authorized");
      return;
    }
    
    // Add issuer
    console.log("Adding authorized issuer...");
    const tx = await Resolver.addAuthorizedIssuer(issuer);
    await tx.wait();
    console.log(`✅ Transaction: ${tx.hash}`);
    
    // Verify
    const isNowAuthorized = await Resolver.isIssuer(issuer);
    if (isNowAuthorized) {
      console.log("✅ Verification successful");
    } else {
      throw new Error("Verification failed");
    }
  });
