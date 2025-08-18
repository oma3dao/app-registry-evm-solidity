import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  tokenid: string;
}

task("token-uri", "Get the token URI for a specific token ID")
  .addParam("tokenid", "The token ID to get URI for")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { tokenid } = taskArgs;
    const tokenId = parseInt(tokenid, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Token URI", hre.network.name, signer.address);
      
      console.log("Token ID:", tokenId);

      const { contract: registry } = await getRegistryContract(hre);

      // Check if token exists
      try {
        const owner = await registry.ownerOf(tokenId);
        console.log("Token owner:", owner);
      } catch (error: any) {
        throw new Error(`Token ID ${tokenId} does not exist`);
      }

      // Get token URI
      const tokenURI = await registry.tokenURI(tokenId);
      
      console.log("\nToken URI:");
      console.log(tokenURI);
      
      // Also get the DID for this token
      try {
        const did = await registry.getDIDByTokenId(tokenId);
        console.log("\nAssociated DID:", did);
      } catch (error: any) {
        console.log("\nCould not retrieve DID for this token");
      }
      
      displayTaskCompletion(true, "Token URI retrieved successfully");

    } catch (error: any) {
      console.error("Error getting token URI:", error.message);
      displayTaskCompletion(false, "Failed to get token URI");
      throw error;
    }
  });
