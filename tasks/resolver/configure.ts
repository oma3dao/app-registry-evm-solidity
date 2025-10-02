import { task } from "hardhat/config";
import { getSecureSigner } from "../shared/signer-utils";

interface ConfigureResolverArgs {
  resolver: string;
  maturation?: string;
  maxTTL?: string;
  issuer?: string;
  removeIssuer?: string;
}

task("configure-resolver", "Configure OMA3ResolverWithStore parameters")
  .addParam("resolver", "Resolver contract address")
  .addOptionalParam("maturation", "Set maturation period in seconds (default: 172800 = 48 hours)")
  .addOptionalParam("maxTTL", "Set maximum TTL in seconds (default: 63072000 = 2 years)")
  .addOptionalParam("issuer", "Add authorized issuer address")
  .addOptionalParam("removeIssuer", "Remove authorized issuer address")
  .setAction(async (taskArgs: ConfigureResolverArgs, hre) => {
    console.log("🔧 Configuring OMA3ResolverWithStore...");
    console.log("Note: This is for development/testing only.");
    console.log("For production, use Thirdweb Dashboard for maximum security.");

    const { signer, address: deployerAddress, method } = await getSecureSigner(hre);
    console.log(`Deployer: ${deployerAddress} (${method})`);

    // Get resolver contract
    const resolver = await hre.ethers.getContractAt("OMA3ResolverWithStore", taskArgs.resolver, signer);
    
    console.log(`\n📋 Current Configuration:`);
    console.log(`Resolver Address: ${taskArgs.resolver}`);
    console.log(`Current Maturation: ${await resolver.maturationSeconds()} seconds`);
    console.log(`Current Max TTL: ${await resolver.maxTTLSeconds()} seconds`);

    // Configure maturation period
    if (taskArgs.maturation) {
      const maturationSeconds = parseInt(taskArgs.maturation);
      console.log(`\n⏰ Setting maturation period to ${maturationSeconds} seconds...`);
      const tx = await resolver.setMaturation(maturationSeconds);
      await tx.wait();
      console.log(`✅ Maturation period updated: ${tx.hash}`);
    }

    // Configure max TTL
    if (taskArgs.maxTTL) {
      const maxTTLSeconds = parseInt(taskArgs.maxTTL);
      console.log(`\n⏰ Setting max TTL to ${maxTTLSeconds} seconds...`);
      const tx = await resolver.setMaxTTL(maxTTLSeconds);
      await tx.wait();
      console.log(`✅ Max TTL updated: ${tx.hash}`);
    }

    // Add authorized issuer
    if (taskArgs.issuer) {
      console.log(`\n👤 Adding authorized issuer: ${taskArgs.issuer}...`);
      const tx = await resolver.addAuthorizedIssuer(taskArgs.issuer);
      await tx.wait();
      console.log(`✅ Issuer added: ${tx.hash}`);
    }

    // Remove authorized issuer
    if (taskArgs.removeIssuer) {
      console.log(`\n👤 Removing authorized issuer: ${taskArgs.removeIssuer}...`);
      const tx = await resolver.removeAuthorizedIssuer(taskArgs.removeIssuer);
      await tx.wait();
      console.log(`✅ Issuer removed: ${tx.hash}`);
    }

    console.log(`\n📋 Updated Configuration:`);
    console.log(`Maturation: ${await resolver.maturationSeconds()} seconds`);
    console.log(`Max TTL: ${await resolver.maxTTLSeconds()} seconds`);
    
    // List authorized issuers
    console.log(`\n👥 Authorized Issuers:`);
    // Note: This would require implementing a function to list issuers
    // For now, we'll just show the configuration is complete
    console.log(`Configuration complete!`);
  });
