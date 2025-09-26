import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  major?: string;
  dataurl?: string;
  datahash?: string;
  algorithm?: string;
  interfaces?: string;
  traits?: string;
  minor?: string;
  patch?: string;
}

task("update-app-controlled", "Update all fields of an app (comprehensive update)")
  .addParam("did", "The DID identifier for the app")
  .addOptionalParam("major", "The major version number", "1")
  .addOptionalParam("dataurl", "New data URL", "")
  .addOptionalParam("datahash", "New data hash (hex)", "0x0000000000000000000000000000000000000000000000000000000000000000")
  .addOptionalParam("algorithm", "Hash algorithm: 'keccak256' or 'sha256'", "keccak256")
  .addOptionalParam("interfaces", "New interface bitmap (0=human, 2=api, 4=smart contract)", "0")
  .addOptionalParam("traits", "Comma-separated trait hashes", "")
  .addOptionalParam("minor", "New minor version", "0")
  .addOptionalParam("patch", "New patch version", "0")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { 
      did, 
      major = "1", 
      dataurl = "", 
      datahash = "0x0000000000000000000000000000000000000000000000000000000000000000",
      algorithm = "keccak256",
      interfaces = "0",
      traits = "",
      minor = "0",
      patch = "0"
    } = taskArgs;
    
    const majorVersion = parseInt(major, 10);
    const interfacesBitmap = parseInt(interfaces, 10);
    const minorVersion = parseInt(minor, 10);
    const patchVersion = parseInt(patch, 10);
    const dataHashAlgorithm = algorithm === "sha256" ? 1 : 0;
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Update App (Controlled)", hre.network.name, signer.address);
      
      console.log("App DID:", did);
      console.log("Major version:", majorVersion);
      console.log("New data URL:", dataurl);
      console.log("New data hash:", datahash);
      console.log("Hash algorithm:", algorithm);
      console.log("New interfaces:", interfacesBitmap);
      console.log("New version:", `${majorVersion}.${minorVersion}.${patchVersion}`);

      const { contract: registry } = await getRegistryContract(hre);

      // Check if app exists and verify ownership
      try {
        const app = await registry.getApp(did, majorVersion);
        console.log(`App found - Owner: ${app.minter}`);
        
        if (app.minter.toLowerCase() !== signer.address.toLowerCase()) {
          throw new Error(`You don't own this app. Owner: ${app.minter}, You: ${signer.address}`);
        }
        
        console.log("✅ Ownership verified");
        
      } catch (error: any) {
        if (error.message.includes("App not found")) {
          throw new Error(`App with DID "${did}" and major version ${majorVersion} not found.`);
        } else {
          throw error;
        }
      }

      // Parse traits
      const traitHashes: string[] = [];
      if (traits) {
        const traitList = traits.split(",").map(k => k.trim());
        for (const trait of traitList) {
          if (trait.startsWith("0x")) {
            traitHashes.push(trait);
          } else {
            // Hash the trait
            traitHashes.push(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(trait)));
          }
        }
        console.log(`Traits: ${traitList.join(", ")}`);
        console.log(`Trait hashes: ${traitHashes.join(", ")}`);
      }

      console.log("Sending update transaction...");
      const tx = await registry.updateAppControlled(
        did,
        majorVersion,
        dataurl,
        datahash,
        dataHashAlgorithm,
        interfacesBitmap,
        traitHashes,
        minorVersion,
        patchVersion
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "App updated successfully");

    } catch (error: any) {
      console.error("Error updating app:", error.message);
      displayTaskCompletion(false, "Failed to update app");
      throw error;
    }
  });
