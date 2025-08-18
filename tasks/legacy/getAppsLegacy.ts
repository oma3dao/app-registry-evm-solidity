import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRequiredEnv, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  startfrom?: string;
}

task("get-apps-legacy", "Fetches applications from the legacy registry with pagination")
  .addOptionalParam("startfrom", "The index to start fetching from", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { startfrom = "0" } = taskArgs;
    const startFromIndex = parseInt(startfrom, 10);
    
    try {
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Applications (Legacy)", hre.network.name, deployer.address);
      
      console.log("Starting from index:", startFromIndex);

      // Use APP_REGISTRY_LEGACY_ADDRESS for legacy contract
      const registryAddress = getRequiredEnv('APP_REGISTRY_LEGACY_ADDRESS');
      console.log("Legacy AppRegistry contract address:", registryAddress);

      const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistryLegacy", registryAddress);

      const result = await appRegistry.getApps(startFromIndex);
      const apps = result.apps || result[0];
      const nextTokenId = result.nextTokenId || result[1];
      
      console.log(`Found ${apps.length} legacy application(s):`);
      
      if (apps.length === 0) {
        console.log("No legacy applications found.");
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

      if (nextTokenId > 0) {
        console.log(`\nMore legacy applications available. Use --startfrom ${nextTokenId} to continue.`);
      }

      displayTaskCompletion(true, `Retrieved ${apps.length} legacy applications`);

    } catch (error: any) {
      console.error("Error fetching legacy apps:", error.message);
      displayTaskCompletion(false, "Failed to retrieve legacy applications");
      throw error;
    }
  });
