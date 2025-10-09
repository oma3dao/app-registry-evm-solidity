import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  status: string;
  startfrom?: string;
}

task("get-apps-by-status", "Get apps filtered by status with pagination")
  .addParam("status", "Status to filter: 'active' (0), 'deprecated' (1), or 'replaced' (2)")
  .addOptionalParam("startfrom", "Index to start fetching from", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { status, startfrom = "0" } = taskArgs;
    const startFromIndex = parseInt(startfrom, 10);
    
    // Parse status
    let statusValue: number;
    let statusName: string;
    switch (status.toLowerCase()) {
      case "active":
      case "0":
        statusValue = 0;
        statusName = "active";
        break;
      case "deprecated":
      case "1":
        statusValue = 1;
        statusName = "deprecated";
        break;
      case "replaced":
      case "2":
        statusValue = 2;
        statusName = "replaced";
        break;
      default:
        throw new Error(`Invalid status: ${status}. Use 'active', 'deprecated', or 'replaced'`);
    }
    
    try {
      displayTaskHeader("Get Apps by Status (read-only)", hre.network.name, "-");
      
      console.log("Status filter:", `${statusName} (${statusValue})`);
      console.log("Starting from index:", startFromIndex);

      const { contract: registry } = await getRegistryContract(hre);

      // Get total count for this status
      const totalCount = await registry.getTotalAppsByStatus(statusValue);
      console.log(`Total ${statusName} apps:`, totalCount.toString());
      
      if (totalCount === 0n) {
        console.log(`No ${statusName} apps found.`);
        displayTaskCompletion(true, "No apps to display");
        return;
      }

      // Get apps by status
      const result = await registry.getAppsByStatus(statusValue, startFromIndex);
      const apps = result.apps || result[0];
      const nextStartIndex = result.nextStartIndex || result[1];
      
      console.log(`\nFound ${apps.length} ${statusName} apps:`);
      
      if (apps.length === 0) {
        console.log("No more apps at this index.");
        displayTaskCompletion(true, "End of results");
        return;
      }

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        console.log(`\n--- ${statusName.charAt(0).toUpperCase() + statusName.slice(1)} App ${i + 1} ---`);
        console.log("DID:", app.did);
        console.log("Major Version:", app.versionMajor);
        console.log("Minter:", app.minter);
        console.log("Interfaces:", app.interfaces);
        console.log("Data URL:", app.dataUrl);
        if (app.contractId) {
          console.log("Contract ID:", app.contractId);
        }
        if (app.fungibleTokenId) {
          console.log("Token ID:", app.fungibleTokenId);
        }
      }

      if (nextStartIndex > 0) {
        console.log(`\nMore ${statusName} apps available. Use --startfrom ${nextStartIndex} to continue.`);
      } else {
        console.log(`\n✅ All ${statusName} apps displayed.`);
      }
      
      displayTaskCompletion(true, `Retrieved ${apps.length} ${statusName} apps`);

    } catch (error: any) {
      console.error("Error fetching apps by status:", error.message);
      displayTaskCompletion(false, "Failed to retrieve apps by status");
      throw error;
    }
  });
