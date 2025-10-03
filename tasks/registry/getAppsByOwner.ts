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
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Applications by Owner", hre.network.name, deployer.address);
      
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
        console.log("Name:", app.name);
        console.log("Version:", `${app.majorVersion}.${app.minorVersion}.${app.patchVersion}`);
        console.log("Data URL:", app.dataUrl);
        console.log("Registry Time:", new Date(Number(app.registryTime) * 1000).toISOString());
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

