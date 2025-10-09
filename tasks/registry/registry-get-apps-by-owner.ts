import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  owner: string;
  startfrom?: string;
}

task("get-apps-by-owner", "Fetches applications by owner address (current NFT owner) with pagination")
  .addParam("owner", "The owner address to search for")
  .addOptionalParam("startfrom", "The index to start fetching from", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { owner, startfrom = "0" } = taskArgs;
    const startFromIndex = parseInt(startfrom, 10);
    
    try {
      displayTaskHeader("Get Applications by Owner (read-only)", hre.network.name, "-");
      
      console.log("Owner address:", owner);
      console.log("Starting from index:", startFromIndex);

      const { contract: appRegistry } = await getRegistryContract(hre);

      // Check if the owner address is valid
      if (!hre.ethers.isAddress(owner)) {
        throw new Error("Invalid owner address format");
      }

      const result = await appRegistry.getAppsByOwner(owner, startFromIndex);
      const { apps, nextStartIndex } = result;
      
      console.log(`Found ${apps.length} application(s) for owner ${owner}:`);
      
      if (apps.length === 0) {
        console.log("No applications found for this owner.");
        displayTaskCompletion(true, "No applications to display");
        return;
      }

      apps.forEach((app: any, index: number) => {
        console.log(`\n--- Application ${index + 1} ---`);
        console.log("DID:", app.did);
        console.log("Minter:", app.minter);
        console.log("Major Version:", Number(app.versionMajor));
        
        // Get current version from version history
        const versionHistory = app.versionHistory || [];
        const currentVersion = versionHistory[versionHistory.length - 1] || { major: Number(app.versionMajor), minor: 0, patch: 0 };
        console.log("Current Version:", `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`);
        console.log("Version History:", versionHistory.map((v: any) => `${v.major}.${v.minor}.${v.patch}`).join(", "));
        
        const interfacesNum = Number(app.interfaces);
        console.log("Interfaces:", interfacesNum, `(Human: ${!!(interfacesNum & 1)}, API: ${!!(interfacesNum & 2)}, Contract: ${!!(interfacesNum & 4)})`);
        const statusNum = Number(app.status);
        const statusLabels = ['Active', 'Deprecated', 'Replaced'];
        console.log("Status:", statusNum, `(${statusLabels[statusNum] || 'Unknown'})`);
        console.log("Data URL:", app.dataUrl);
        console.log("Data Hash:", app.dataHash);
        console.log("Contract ID:", app.contractId || "(none)");
        console.log("Fungible Token ID:", app.fungibleTokenId || "(none)");
        console.log("Trait Hashes:", app.traitHashes?.length || 0);
      });

      if (nextStartIndex > 0) {
        console.log(`\nMore applications available. Use --startfrom ${nextStartIndex} to continue.`);
      }

      displayTaskCompletion(true, `Retrieved ${apps.length} applications for owner`);

    } catch (error: any) {
      console.error("Error fetching apps by owner:", error.message);
      displayTaskCompletion(false, "Failed to retrieve applications by owner");
      throw error;
    }
  });

