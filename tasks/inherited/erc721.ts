import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface OwnerOfArgs {
  tokenid: string;
}

interface BalanceOfArgs {
  address: string;
}

interface ApproveArgs {
  to: string;
  tokenid: string;
}

interface TransferArgs {
  from: string;
  to: string;
  tokenid: string;
}

// ERC721 View Functions
task("owner-of", "Get the owner of a specific token")
  .addParam("tokenid", "The token ID to check")
  .setAction(async (taskArgs: OwnerOfArgs, hre: HardhatRuntimeEnvironment) => {
    const { tokenid } = taskArgs;
    const tokenId = parseInt(tokenid, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Token Owner", hre.network.name, signer.address);
      
      console.log("Token ID:", tokenId);

      const { contract: registry } = await getRegistryContract(hre);

      const owner = await registry.ownerOf(tokenId);
      console.log("Owner:", owner);
      
      // Get DID if possible
      try {
        const did = await registry.getDIDByTokenId(tokenId);
        console.log("DID:", did);
      } catch (error: any) {
        console.log("DID: (not available)");
      }
      
      displayTaskCompletion(true, "Token owner retrieved");

    } catch (error: any) {
      console.error("Error getting token owner:", error.message);
      displayTaskCompletion(false, "Failed to get token owner");
      throw error;
    }
  });

task("balance-of", "Get the number of tokens owned by an address")
  .addParam("address", "The address to check")
  .setAction(async (taskArgs: BalanceOfArgs, hre: HardhatRuntimeEnvironment) => {
    const { address } = taskArgs;
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Address Balance", hre.network.name, signer.address);
      
      console.log("Address:", address);

      const { contract: registry } = await getRegistryContract(hre);

      const balance = await registry.balanceOf(address);
      console.log("Token balance:", balance.toString());
      
      // Also get total by minter for comparison
      try {
        const totalByMinter = await registry.getTotalAppsByMinter(address);
        console.log("Total apps by minter:", totalByMinter.toString());
        
        if (balance.toString() !== totalByMinter.toString()) {
          console.log("⚠️ Balance and minter count differ (transfers may have occurred)");
        }
      } catch (error: any) {
        // Ignore if getTotalAppsByMinter fails
      }
      
      displayTaskCompletion(true, `Found ${balance} tokens`);

    } catch (error: any) {
      console.error("Error getting balance:", error.message);
      displayTaskCompletion(false, "Failed to get balance");
      throw error;
    }
  });

task("get-approved", "Get the approved address for a token")
  .addParam("tokenid", "The token ID to check")
  .setAction(async (taskArgs: OwnerOfArgs, hre: HardhatRuntimeEnvironment) => {
    const { tokenid } = taskArgs;
    const tokenId = parseInt(tokenid, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Get Token Approval", hre.network.name, signer.address);
      
      console.log("Token ID:", tokenId);

      const { contract: registry } = await getRegistryContract(hre);

      const approved = await registry.getApproved(tokenId);
      console.log("Approved address:", approved);
      
      if (approved === "0x0000000000000000000000000000000000000000") {
        console.log("Status: No approval set");
      } else {
        console.log("Status: Approved for transfer");
      }
      
      displayTaskCompletion(true, "Approval status retrieved");

    } catch (error: any) {
      console.error("Error getting approval:", error.message);
      displayTaskCompletion(false, "Failed to get approval");
      throw error;
    }
  });

// ERC721 Write Functions
task("approve", "Approve an address to transfer a specific token")
  .addParam("to", "Address to approve")
  .addParam("tokenid", "Token ID to approve")
  .setAction(async (taskArgs: ApproveArgs, hre: HardhatRuntimeEnvironment) => {
    const { to, tokenid } = taskArgs;
    const tokenId = parseInt(tokenid, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Approve Token Transfer", hre.network.name, signer.address);
      
      console.log("Token ID:", tokenId);
      console.log("Approve to:", to);

      const { contract: registry } = await getRegistryContract(hre);

      // Check ownership
      const owner = await registry.ownerOf(tokenId);
      if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error(`You don't own this token. Owner: ${owner}, You: ${signer.address}`);
      }

      console.log("✅ Ownership verified");
      console.log("Sending approval transaction...");
      
      const tx = await registry.approve(to, tokenId);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "Token approved successfully");

    } catch (error: any) {
      console.error("Error approving token:", error.message);
      displayTaskCompletion(false, "Failed to approve token");
      throw error;
    }
  });

task("transfer-from", "Transfer a token from one address to another")
  .addParam("from", "Address to transfer from")
  .addParam("to", "Address to transfer to") 
  .addParam("tokenid", "Token ID to transfer")
  .setAction(async (taskArgs: TransferArgs, hre: HardhatRuntimeEnvironment) => {
    const { from, to, tokenid } = taskArgs;
    const tokenId = parseInt(tokenid, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Transfer Token", hre.network.name, signer.address);
      
      console.log("From:", from);
      console.log("To:", to);
      console.log("Token ID:", tokenId);

      const { contract: registry } = await getRegistryContract(hre);

      // Check permissions
      const owner = await registry.ownerOf(tokenId);
      const approved = await registry.getApproved(tokenId);
      
      console.log("Current owner:", owner);
      console.log("Approved address:", approved);
      
      const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
      const isApproved = approved.toLowerCase() === signer.address.toLowerCase();
      
      if (!isOwner && !isApproved) {
        throw new Error(`Not authorized to transfer this token. Owner: ${owner}, Approved: ${approved}, You: ${signer.address}`);
      }

      console.log("✅ Transfer authorization verified");
      console.log("Sending transfer transaction...");
      
      const tx = await registry.transferFrom(from, to, tokenId);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "Token transferred successfully");

    } catch (error: any) {
      console.error("Error transferring token:", error.message);
      displayTaskCompletion(false, "Failed to transfer token");
      throw error;
    }
  });
