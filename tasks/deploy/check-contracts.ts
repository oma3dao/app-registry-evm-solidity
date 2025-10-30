import { task } from "hardhat/config";
import { getContractAddresses } from "../shared/env-helpers";

task("check-contracts", "Check deployed contract status and configuration")
  .addOptionalParam("registry", "Registry contract address override")
  .addOptionalParam("metadata", "Metadata contract address override")
  .addOptionalParam("resolver", "Resolver contract address override")
  .setAction(async (taskArgs, hre) => {
    // Get contract addresses from config or use overrides
    let addresses;
    try {
      addresses = getContractAddresses(hre);
    } catch (error: any) {
      console.log(`\n⚠️  Warning: ${error.message}`);
      console.log("Using provided addresses or skipping checks...\n");
      addresses = { registry: "0x", metadata: "0x", resolver: "0x" };
    }

    const metadataAddress = taskArgs.metadata || addresses.metadata;
    const registryAddress = taskArgs.registry || addresses.registry;
    const resolverAddress = taskArgs.resolver || addresses.resolver;

    console.log(`\n🔍 Checking contract deployments on ${hre.network.name}`);
    console.log(`Network: ${hre.network.name} (Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId})\n`);

    // Check Metadata contract
    if (metadataAddress && metadataAddress !== "0x") {
      console.log("📄 Metadata Contract:", metadataAddress);
      try {
        const metadataCode = await hre.ethers.provider.getCode(metadataAddress);
        console.log("  Bytecode length:", metadataCode.length);
        console.log("  Has code:", metadataCode !== "0x");

        if (metadataCode !== "0x") {
          const Metadata = await hre.ethers.getContractAt("OMA3AppMetadata", metadataAddress);
          const owner = await Metadata.owner();
          console.log("  ✅ Owner:", owner);
          const authorizedRegistry = await Metadata.authorizedRegistry();
          console.log("  ✅ Authorized Registry:", authorizedRegistry);
        } else {
          console.log("  ❌ No bytecode found at this address");
        }
      } catch (error: any) {
        console.log("  ❌ Error:", error.message);
      }
    } else {
      console.log("📄 Metadata Contract: Not configured");
    }

    // Check Registry contract
    if (registryAddress && registryAddress !== "0x") {
      console.log("\n📋 Registry Contract:", registryAddress);
      try {
        const registryCode = await hre.ethers.provider.getCode(registryAddress);
        console.log("  Bytecode length:", registryCode.length);
        console.log("  Has code:", registryCode !== "0x");

        if (registryCode !== "0x") {
          const Registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress);
          const owner = await Registry.owner();
          console.log("  ✅ Owner:", owner);
          const metadataContract = await Registry.metadataContract();
          console.log("  ✅ Metadata Contract:", metadataContract);
          const ownershipResolver = await Registry.ownershipResolver();
          console.log("  ✅ Ownership Resolver:", ownershipResolver);
        } else {
          console.log("  ❌ No bytecode found at this address");
        }
      } catch (error: any) {
        console.log("  ❌ Error:", error.message);
      }
    } else {
      console.log("\n📋 Registry Contract: Not configured");
    }

    // Check Resolver contract
    if (resolverAddress && resolverAddress !== "0x") {
      console.log("\n🔍 Resolver Contract:", resolverAddress);
      try {
        const resolverCode = await hre.ethers.provider.getCode(resolverAddress);
        console.log("  Bytecode length:", resolverCode.length);
        console.log("  Has code:", resolverCode !== "0x");

        if (resolverCode !== "0x") {
          const Resolver = await hre.ethers.getContractAt("OMA3ResolverWithStore", resolverAddress);
          const owner = await Resolver.owner();
          console.log("  ✅ Owner:", owner);
          const maturationSeconds = await Resolver.maturationSeconds();
          console.log("  ✅ Maturation Period:", maturationSeconds.toString(), "seconds");
          const maxTTLSeconds = await Resolver.maxTTLSeconds();
          console.log("  ✅ Max TTL:", maxTTLSeconds.toString(), "seconds");

          // Get authorized issuers by checking indices until we hit an error
          const issuers: string[] = [];
          try {
            let index = 0;
            while (true) {
              const issuer = await Resolver.authorizedIssuers(index);
              issuers.push(issuer);
              index++;
            }
          } catch {
            // Expected - we've reached the end of the array
          }
          console.log("  ✅ Authorized Issuers:", issuers.length);
          if (issuers.length > 0) {
            issuers.forEach((issuer, idx) => {
              console.log(`     ${idx + 1}. ${issuer}`);
            });
          }
        } else {
          console.log("  ❌ No bytecode found at this address");
        }
      } catch (error: any) {
        console.log("  ❌ Error:", error.message);
      }
    } else {
      console.log("\n🔍 Resolver Contract: Not configured");
    }

    console.log("\n");
  });
