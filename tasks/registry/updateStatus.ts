import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  major?: string;
  status: string;
}

task("update-status", "Update the status of an app")
  .addParam("did", "The DID identifier for the app")
  .addParam("status", "New status: 'active' (0), 'deprecated' (1), or 'replaced' (2)")
  .addOptionalParam("major", "The major version number", "1")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, status, major = "1" } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    // Parse status
    let statusValue: number;
    switch (status.toLowerCase()) {
      case "active":
      case "0":
        statusValue = 0;
        break;
      case "deprecated":
      case "1":
        statusValue = 1;
        break;
      case "replaced":
      case "2":
        statusValue = 2;
        break;
      default:
        throw new Error(`Invalid status: ${status}. Use 'active', 'deprecated', or 'replaced'`);
    }
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Update App Status", hre.network.name, signer.address);
      
      console.log("App DID:", did);
      console.log("Major version:", majorVersion);
      console.log("New status:", `${status} (${statusValue})`);

      const { contract: registry } = await getRegistryContract(hre);

      // Check if app exists and verify ownership
      try {
        const app = await registry.getApp(did, majorVersion);
        console.log(`App found - Owner: ${app.minter}`);
        console.log(`Current status: ${app.status}`);
        
        if (app.minter.toLowerCase() !== signer.address.toLowerCase()) {
          throw new Error(`You don't own this app. Owner: ${app.minter}, You: ${signer.address}`);
        }
        
        if (Number(app.status) === statusValue) {
          console.log("⚠️ App already has this status");
          displayTaskCompletion(true, "No change needed");
          return;
        }
        
        console.log("✅ Ownership verified");
        
      } catch (error: any) {
        if (error.message.includes("App not found")) {
          throw new Error(`App with DID "${did}" and major version ${majorVersion} not found.`);
        } else {
          throw error;
        }
      }

      console.log("Sending status update transaction...");
      const tx = await registry.updateStatus(did, majorVersion, statusValue);
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, `App status updated to ${status}`);

    } catch (error: any) {
      console.error("Error updating status:", error.message);
      displayTaskCompletion(false, "Failed to update status");
      throw error;
    }
  });
