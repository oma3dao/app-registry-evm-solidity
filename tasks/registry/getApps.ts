import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

task("get-apps", "Fetches all applications from the registry")
  .setAction(async (taskArgs: {}, hre: HardhatRuntimeEnvironment) => {
    try {
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get All Applications", hre.network.name, deployer.address);

      const { contract: appRegistry } = await getRegistryContract(hre);

      const totalApps = await appRegistry.totalSupply();
      console.log("Total applications:", totalApps.toString());

      if (totalApps === 0n) {
        console.log("No applications found in the registry.");
        displayTaskCompletion(true, "No applications to display");
        return;
      }

      // Note: This implementation uses getApps() to retrieve all apps
      // since tokenByIndex and getAppByTokenId are not available
      console.log("\nFetching applications...");
      
      try {
        const result = await appRegistry.getApps(0); // Start from index 0
        const apps = result.apps || result[0]; // Handle tuple destructuring
        
        if (apps.length === 0) {
          console.log("No applications found.");
        } else {
          console.log(`\nFound ${apps.length} applications:`);
          
          for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            console.log(`\n--- Application ${i + 1} ---`);
            console.log("DID:", app.did);
            console.log("Major Version:", app.versionMajor);
            console.log("Minter:", app.minter);
            console.log("Status:", app.status);
            console.log("Data URL:", app.dataUrl);
            console.log("Interfaces:", app.interfaces);
          }
        }
      } catch (error: any) {
        console.error("Error fetching applications:", error.message);
        throw error;
      }

      displayTaskCompletion(true, `Retrieved ${totalApps} applications`);

    } catch (error: any) {
      console.error("Error fetching applications:", error.message);
      displayTaskCompletion(false, "Failed to retrieve applications");
      throw error;
    }
  });
