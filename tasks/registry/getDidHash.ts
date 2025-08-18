import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
}

task("get-did-hash", "Get the hash of a DID string")
  .addParam("did", "The DID identifier to hash")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did } = taskArgs;
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get DID Hash", hre.network.name, signer.address);
      
      console.log("DID:", did);

      const { contract: registry } = await getRegistryContract(hre);

      // Get hash from contract
      const contractHash = await registry.getDidHash(did);
      
      // Also calculate locally for comparison
      const localHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));
      
      console.log("\nResults:");
      console.log("Contract hash:", contractHash);
      console.log("Local hash:   ", localHash);
      console.log("Match:        ", contractHash === localHash ? "✅ Yes" : "❌ No");
      
      displayTaskCompletion(true, "DID hash retrieved successfully");

    } catch (error: any) {
      console.error("Error getting DID hash:", error.message);
      displayTaskCompletion(false, "Failed to get DID hash");
      throw error;
    }
  });
