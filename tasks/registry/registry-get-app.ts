import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  major: string;
}

task("get-app", "Fetches an application by its DID and major version")
  .addParam("did", "The Decentralized Identifier of the application")
  .addParam("major", "The major version number", "1", undefined, true)
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, major } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    try {
      displayTaskHeader("Get Application (read-only)", hre.network.name, "-");
      
      console.log("Fetching app for DID:", did);
      console.log("Major version:", majorVersion);

      const { contract: appRegistry } = await getRegistryContract(hre);

      const app = await appRegistry.getApp(did, majorVersion);
      
      console.log("Application found:");
      console.log("DID:", app.did);
      console.log("Minter:", app.minter);
      console.log("Major Version:", app.versionMajor);
      
      // Display version history
      const versionHistory = app.versionHistory || [];
      if (versionHistory.length > 0) {
        console.log("Version History:");
        versionHistory.forEach((version: any, index: number) => {
          console.log(`  ${index + 1}. ${version.major}.${version.minor}.${version.patch}`);
        });
        
        // Show current version
        const currentVersion = versionHistory[versionHistory.length - 1];
        console.log(`Current Version: ${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`);
      } else {
        console.log("Version History: No versions recorded");
        console.log("Current Version: 1.0.0 (default)");
      }
      
      // Display interfaces with human-readable format
      const interfacesNum = Number(app.interfaces);
      console.log("Interfaces:", interfacesNum, `(Human: ${!!(interfacesNum & 1)}, API: ${!!(interfacesNum & 2)}, Contract: ${!!(interfacesNum & 4)})`);
      
      // Display status with human-readable format
      const statusNum = Number(app.status);
      const statusLabels = ['Active', 'Deprecated', 'Replaced'];
      console.log("Status:", statusNum, `(${statusLabels[statusNum] || 'Unknown'})`);
      
      console.log("Data URL:", app.dataUrl);
      console.log("Data Hash:", app.dataHash);
      console.log("Data Hash Algorithm:", app.dataHashAlgorithm);
      console.log("Contract ID:", app.contractId || "(none)");
      console.log("Fungible Token ID:", app.fungibleTokenId || "(none)");
      
      // Display trait hashes
      const traitHashes = app.traitHashes || [];
      console.log("Trait Hashes:", traitHashes.length);
      if (traitHashes.length > 0) {
        traitHashes.forEach((hash: string, index: number) => {
          console.log(`  ${index + 1}. ${hash}`);
        });
      }

      displayTaskCompletion(true, "Application retrieved successfully");

    } catch (error: any) {
      console.error("Error fetching app:", error.message);
      if (error.message.includes("App not found")) {
        console.error(`No application found with DID "${did}" and major version ${majorVersion}`);
      }
      displayTaskCompletion(false, "Failed to retrieve application");
      throw error;
    }
  });
