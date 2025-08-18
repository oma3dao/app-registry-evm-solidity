import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRequiredEnv, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  minter: string;
  startfrom?: string;
}

task("get-apps-by-minter-legacy", "Fetches applications by minter from the legacy registry")
  .addParam("minter", "The minter address to search for")
  .addOptionalParam("startfrom", "The index to start fetching from", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { minter, startfrom = "0" } = taskArgs;
    const startFromIndex = parseInt(startfrom, 10);
    
    try {
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Applications by Minter (Legacy)", hre.network.name, deployer.address);
      
      console.log("Minter address:", minter);
      console.log("Starting from index:", startFromIndex);

      // Use APP_REGISTRY_LEGACY_ADDRESS for legacy contract
      const registryAddress = getRequiredEnv('APP_REGISTRY_LEGACY_ADDRESS');
      console.log("Legacy AppRegistry contract address:", registryAddress);

      const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistryLegacy", registryAddress);

      // Check if the minter address is valid
      if (!hre.ethers.isAddress(minter)) {
        throw new Error("Invalid minter address format");
      }

      const apps = await appRegistry.getAppsByMinter(minter);
      
      console.log(`Found ${apps.length} legacy application(s) for minter ${minter}:`);
      
      if (apps.length === 0) {
        console.log("No legacy applications found for this minter.");
        displayTaskCompletion(true, "No applications to display");
        return;
      }

      apps.forEach((app: any, index: number) => {
        console.log(`\n--- Legacy Application ${index + 1} ---`);
        console.log("DID:", app.did);
        console.log("Data URL:", app.dataUrl);
        console.log("Minter:", app.minter);
        // Legacy format may have different fields
        if (app.name) {
          console.log("Name:", hre.ethers.decodeBytes32String ? hre.ethers.decodeBytes32String(app.name) : app.name);
        }
        if (app.version) {
          console.log("Version:", hre.ethers.decodeBytes32String ? hre.ethers.decodeBytes32String(app.version) : app.version);
        }
      });

      // Note: getAppsByMinter in legacy contract returns all apps for a minter
      // No pagination available in this version

      displayTaskCompletion(true, `Retrieved ${apps.length} legacy applications for minter`);

    } catch (error: any) {
      console.error("Error fetching legacy apps by minter:", error.message);
      displayTaskCompletion(false, "Failed to retrieve legacy applications by minter");
      throw error;
    }
  });
