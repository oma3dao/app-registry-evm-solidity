import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TransferOwnershipArgs {
  newowner: string;
}

// Ownable Functions
task("get-owner", "Get the current owner of the contract")
  .setAction(async (taskArgs: {}, hre: HardhatRuntimeEnvironment) => {
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Contract Owner", hre.network.name, signer.address);

      const { contract: registry } = await getRegistryContract(hre);

      const owner = await registry.owner();
      console.log("Contract owner:", owner);
      console.log("Current signer:", signer.address);
      console.log("Is signer owner:", owner.toLowerCase() === signer.address.toLowerCase() ? "✅ Yes" : "❌ No");
      
      displayTaskCompletion(true, "Contract owner retrieved");

    } catch (error: any) {
      console.error("Error getting contract owner:", error.message);
      displayTaskCompletion(false, "Failed to get contract owner");
      throw error;
    }
  });

task("transfer-ownership", "Transfer ownership of the contract")
  .addParam("newowner", "Address of the new owner")
  .setAction(async (taskArgs: TransferOwnershipArgs, hre: HardhatRuntimeEnvironment) => {
    const { newowner } = taskArgs;
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Transfer Contract Ownership", hre.network.name, signer.address);
      
      console.log("New owner:", newowner);

      const { contract: registry } = await getRegistryContract(hre);

      // Check current ownership
      const currentOwner = await registry.owner();
      console.log("Current owner:", currentOwner);
      
      if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error(`Only the current owner can transfer ownership. Owner: ${currentOwner}, You: ${signer.address}`);
      }
      
      if (currentOwner.toLowerCase() === newowner.toLowerCase()) {
        console.log("⚠️ New owner is the same as current owner");
        displayTaskCompletion(true, "No change needed");
        return;
      }

      console.log("✅ Ownership verified");
      console.log("⚠️ WARNING: This will permanently transfer ownership!");
      console.log("Sending ownership transfer transaction...");
      
      const tx = await registry.transferOwnership(newowner);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      // Verify the transfer
      const finalOwner = await registry.owner();
      console.log("New contract owner:", finalOwner);
      
      displayTaskCompletion(true, "Ownership transferred successfully");

    } catch (error: any) {
      console.error("Error transferring ownership:", error.message);
      displayTaskCompletion(false, "Failed to transfer ownership");
      throw error;
    }
  });

task("renounce-ownership", "Renounce ownership of the contract (irreversible!)")
  .setAction(async (taskArgs: {}, hre: HardhatRuntimeEnvironment) => {
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Renounce Contract Ownership", hre.network.name, signer.address);

      const { contract: registry } = await getRegistryContract(hre);

      // Check current ownership
      const currentOwner = await registry.owner();
      console.log("Current owner:", currentOwner);
      
      if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error(`Only the current owner can renounce ownership. Owner: ${currentOwner}, You: ${signer.address}`);
      }

      console.log("✅ Ownership verified");
      console.log("🚨 DANGER: This will permanently renounce ownership!");
      console.log("🚨 The contract will become ownerless and unmanageable!");
      console.log("Sending renounce ownership transaction...");
      
      const tx = await registry.renounceOwnership();
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      // Verify the renouncement
      const finalOwner = await registry.owner();
      console.log("Final contract owner:", finalOwner);
      
      if (finalOwner === "0x0000000000000000000000000000000000000000") {
        console.log("✅ Ownership successfully renounced");
      }
      
      displayTaskCompletion(true, "Ownership renounced successfully");

    } catch (error: any) {
      console.error("Error renouncing ownership:", error.message);
      displayTaskCompletion(false, "Failed to renounce ownership");
      throw error;
    }
  });
