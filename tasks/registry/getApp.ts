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
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Application", hre.network.name, deployer.address);
      
      console.log("Fetching app for DID:", did);
      console.log("Major version:", majorVersion);

      const { contract: appRegistry } = await getRegistryContract(hre);

      const app = await appRegistry.getApp(did, majorVersion);
      
      console.log("Application found:");
      console.log("DID:", app.did);
      console.log("Interfaces:", app.interfaces);
      console.log("Data URL:", app.dataUrl);
      console.log("Data Hash:", app.dataHash);
      console.log("Data Hash Algorithm:", app.dataHashAlgorithm);
      console.log("Major Version:", app.versionMajor);
      console.log("Minter:", app.minter);
      console.log("Status:", app.status);
      console.log("Contract ID:", app.contractId);
      console.log("Fungible Token ID:", app.fungibleTokenId);

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
