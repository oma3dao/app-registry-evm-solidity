import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

task("total-supply", "Get the total number of registered apps")
  .setAction(async (taskArgs: {}, hre: HardhatRuntimeEnvironment) => {
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Total Supply", hre.network.name, signer.address);

      const { contract: registry } = await getRegistryContract(hre);

      const totalSupply = await registry.totalSupply();
      
      console.log("Total registered apps:", totalSupply.toString());
      
      // Also get breakdown by status if there are apps
      if (totalSupply > 0n) {
        console.log("\nBreakdown by status:");
        
        try {
          const activeCount = await registry.getTotalAppsByStatus(0);
          const deprecatedCount = await registry.getTotalAppsByStatus(1);
          const replacedCount = await registry.getTotalAppsByStatus(2);
          
          console.log(`  Active:     ${activeCount.toString()}`);
          console.log(`  Deprecated: ${deprecatedCount.toString()}`);
          console.log(`  Replaced:   ${replacedCount.toString()}`);
          console.log(`  Total:      ${totalSupply.toString()}`);
          
        } catch (error: any) {
          console.log("  (Status breakdown not available)");
        }
      }
      
      displayTaskCompletion(true, `Found ${totalSupply} registered apps`);

    } catch (error: any) {
      console.error("Error getting total supply:", error.message);
      displayTaskCompletion(false, "Failed to get total supply");
      throw error;
    }
  });
