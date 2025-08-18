import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  minter: string;
  startfrom?: string;
}

task("get-apps-by-minter", "Fetches applications by minter address with pagination")
  .addParam("minter", "The minter address to search for")
  .addOptionalParam("startfrom", "The index to start fetching from", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { minter, startfrom = "0" } = taskArgs;
    const startFromIndex = parseInt(startfrom, 10);
    
    try {
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Applications by Minter", hre.network.name, deployer.address);
      
      console.log("Minter address:", minter);
      console.log("Starting from index:", startFromIndex);

      const { contract: appRegistry } = await getRegistryContract(hre);

      // Check if the minter address is valid
      if (!hre.ethers.isAddress(minter)) {
        throw new Error("Invalid minter address format");
      }

      const result = await appRegistry.getAppsByMinter(minter, startFromIndex);
      const { apps, nextStartIndex } = result;
      
      console.log(`Found ${apps.length} application(s) for minter ${minter}:`);
      
      if (apps.length === 0) {
        console.log("No applications found for this minter.");
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

      displayTaskCompletion(true, `Retrieved ${apps.length} applications for minter`);

    } catch (error: any) {
      console.error("Error fetching apps by minter:", error.message);
      displayTaskCompletion(false, "Failed to retrieve applications by minter");
      throw error;
    }
  });
