import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  keywords: string;
  major?: string;
  mode?: string;
}

task("has-keywords", "Check if an app has specific keywords (any or all)")
  .addParam("did", "The DID identifier for the app")
  .addParam("keywords", "Comma-separated keywords to check")
  .addOptionalParam("major", "The major version number", "1")
  .addOptionalParam("mode", "Check mode: 'any' or 'all'", "any")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, keywords, major = "1", mode = "any" } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    if (mode !== "any" && mode !== "all") {
      throw new Error(`Invalid mode: ${mode}. Use 'any' or 'all'`);
    }
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Check App Keywords", hre.network.name, signer.address);
      
      console.log("App DID:", did);
      console.log("Major version:", majorVersion);
      console.log("Check mode:", mode);

      const { contract: registry } = await getRegistryContract(hre);

      // Parse and hash keywords
      const keywordList = keywords.split(",").map(k => k.trim());
      const keywordHashes: string[] = [];
      
      console.log("\nKeywords to check:");
      for (const keyword of keywordList) {
        let hash: string;
        if (keyword.startsWith("0x")) {
          hash = keyword;
          console.log(`  "${keyword}" (already hashed)`);
        } else {
          hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(keyword));
          console.log(`  "${keyword}" → ${hash}`);
        }
        keywordHashes.push(hash);
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

      // Check keywords
      let hasKeywords: boolean;
      if (mode === "any") {
        hasKeywords = await registry.hasAnyKeywords(did, majorVersion, keywordHashes);
        console.log(`\nHas ANY of the keywords: ${hasKeywords ? "✅ Yes" : "❌ No"}`);
      } else {
        hasKeywords = await registry.hasAllKeywords(did, majorVersion, keywordHashes);
        console.log(`\nHas ALL of the keywords: ${hasKeywords ? "✅ Yes" : "❌ No"}`);
      }
      
      displayTaskCompletion(true, `Keyword check completed: ${hasKeywords}`);

    } catch (error: any) {
      console.error("Error checking keywords:", error.message);
      displayTaskCompletion(false, "Failed to check keywords");
      throw error;
    }
  });
