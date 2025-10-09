import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  traits: string;
  major?: string;
  mode?: string;
}

task("has-traits", "Check if an app has specific traits (any or all)")
  .addParam("did", "The DID identifier for the app")
  .addParam("traits", "Comma-separated traits to check")
  .addOptionalParam("major", "The major version number", "1")
  .addOptionalParam("mode", "Check mode: 'any' or 'all'", "any")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, traits, major = "1", mode = "any" } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    if (mode !== "any" && mode !== "all") {
      throw new Error(`Invalid mode: ${mode}. Use 'any' or 'all'`);
    }
    
    try {
      displayTaskHeader("Check App Traits (read-only)", hre.network.name, "-");
      
      console.log("App DID:", did);
      console.log("Major version:", majorVersion);
      console.log("Check mode:", mode);

      const { contract: registry } = await getRegistryContract(hre);

      // Parse and hash traits
      const traitList = traits.split(",").map(k => k.trim());
      const traitHashes: string[] = [];
      
      console.log("\nTraits to check:");
      for (const trait of traitList) {
        let hash: string;
        if (trait.startsWith("0x")) {
          hash = trait;
          console.log(`  "${trait}" (already hashed)`);
        } else {
          hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(trait));
          console.log(`  "${trait}" → ${hash}`);
        }
        traitHashes.push(hash);
      }

      // Check if app exists
      try {
        const app = await registry.getApp(did, majorVersion);
        console.log(`\nApp found - Owner: ${app.minter}`);
      } catch (error: any) {
        if (error.message.includes("App not found")) {
          throw new Error(`App with DID "${did}" and major version ${majorVersion} not found.`);
        } else {
          throw error;
        }
      }

      // Check traits
      let hasTraits: boolean;
      if (mode === "any") {
        hasTraits = await registry.hasAnyTraits(did, majorVersion, traitHashes);
        console.log(`\nHas ANY of the traits: ${hasTraits ? "✅ Yes" : "❌ No"}`);
      } else {
        hasTraits = await registry.hasAllTraits(did, majorVersion, traitHashes);
        console.log(`\nHas ALL of the traits: ${hasTraits ? "✅ Yes" : "❌ No"}`);
      }
      
      displayTaskCompletion(true, `Trait check completed: ${hasTraits}`);

    } catch (error: any) {
      console.error("Error checking traits:", error.message);
      displayTaskCompletion(false, "Failed to check traits");
      throw error;
    }
  });
