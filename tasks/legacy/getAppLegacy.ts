import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRequiredEnv, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  major: string;
}

task("get-app-legacy", "Fetches an application by its DID and major version from the legacy registry")
  .addParam("did", "The Decentralized Identifier of the application")
  .addParam("major", "The major version number", "1", undefined, true)
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, major } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    try {
      const [deployer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Application (Legacy)", hre.network.name, deployer.address);
      
      console.log("Fetching app for DID:", did);
      console.log("Major version:", majorVersion);

      // Use APP_REGISTRY_LEGACY_ADDRESS for legacy contract
      const registryAddress = getRequiredEnv('APP_REGISTRY_LEGACY_ADDRESS');
      console.log("Legacy AppRegistry contract address:", registryAddress);

      const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistryLegacy", registryAddress);

      const app = await appRegistry.getApp(did);
      
      console.log("Legacy Application found:");
      console.log("DID:", app.did);
      console.log("Name:", app.name);
      console.log("Version:", app.version);
      console.log("Data URL:", app.dataUrl);
      console.log("IWPS Portal URI:", app.iwpsPortalUri);
      console.log("Agent API URI:", app.agentApiUri);
      console.log("Minter:", app.minter);
      console.log("Status:", app.status);

      displayTaskCompletion(true, "Legacy application retrieved successfully");

    } catch (error: any) {
      console.error("Error fetching legacy app:", error.message);
      if (error.message.includes("App not found")) {
        console.error(`No legacy application found with DID "${did}" and major version ${majorVersion}`);
      }
      displayTaskCompletion(false, "Failed to retrieve legacy application");
      throw error;
    }
  });
