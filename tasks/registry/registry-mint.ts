import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import * as path from 'path';
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";
import { getUserSigner } from "../shared/signer-utils";

interface TaskArgs {
  did: string;
  interfaces: string;
  dataurl: string;
  datahash?: string;
  algorithm?: string;
  fungibletokenid?: string;
  contractid?: string;
  major?: string;
  minor?: string;
  patch?: string;
  traits?: string;
  jsonfile?: string;
}

task("mint", "Mint a new application NFT")
  .addParam("did", "The DID identifier for the app")
  .addParam("interfaces", "Interface bitmap (0=human, 2=api, 4=smart contract)", "0")
  .addParam("dataurl", "URL to off-chain metadata")
  .addOptionalParam("datahash", "Hash of the off-chain data (auto-calculated if not provided)")
  .addOptionalParam("algorithm", "Hash algorithm: 'keccak256' or 'sha256'", "keccak256")
  .addOptionalParam("fungibletokenid", "CAIP-19 fungible token ID", "")
  .addOptionalParam("contractid", "CAIP-10 contract address", "")
  .addOptionalParam("major", "Initial major version", "1")
  .addOptionalParam("minor", "Initial minor version", "0")
  .addOptionalParam("patch", "Initial patch version", "0")
  .addOptionalParam("traits", "Comma-separated traits for tagging", "")
  .addOptionalParam("jsonfile", "Path to JSON file for on-chain metadata (empty to skip)", "")
  .addOptionalParam("signerFileName", "~/.ssh/<file> containing hex private key")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { 
      did, 
      interfaces, 
      dataurl, 
      datahash, 
      algorithm = "keccak256",
      fungibletokenid = "",
      contractid = "",
      major = "1",
      minor = "0", 
      patch = "0",
      traits = "",
      jsonfile = ""
    } = taskArgs;
    
    const interfacesBitmap = parseInt(interfaces, 10);
    const majorVersion = parseInt(major, 10);
    const minorVersion = parseInt(minor, 10);
    const patchVersion = parseInt(patch, 10);
    const dataHashAlgorithm = algorithm === "sha256" ? 1 : 0;
    
    try {
      const { signer, address } = await getUserSigner(hre, taskArgs as any);
      displayTaskHeader("Mint New App", hre.network.name, address);
      
      console.log("App DID:", did);
      console.log("Interfaces:", interfacesBitmap);
      console.log("Data URL:", dataurl);
      console.log("Hash algorithm:", algorithm);
      console.log("Fungible token ID:", fungibletokenid || "(none)");
      console.log("Contract ID:", contractid || "(none)");
      console.log("Initial version:", `${majorVersion}.${minorVersion}.${patchVersion}`);

      const { contract: registry } = await getRegistryContract(hre);

      // Parse traits
      const traitHashes: string[] = [];
      if (traits) {
        const traitList = traits.split(",").map(k => k.trim());
        console.log("\nTraits:");
        for (const trait of traitList) {
          if (trait.startsWith("0x")) {
            traitHashes.push(trait);
            console.log(`  "${trait}" (already hashed)`);
          } else {
            const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(trait));
            traitHashes.push(hash);
            console.log(`  "${trait}" → ${hash}`);
          }
        }
      }

      // Get metadata JSON if provided
      let metadataJson = "";
      if (jsonfile) {
        try {
          if (jsonfile.startsWith("{") || jsonfile.startsWith("[")) {
            // Input is already a JSON string
            metadataJson = JSON.stringify(JSON.parse(jsonfile));
            console.log("\nUsing provided JSON string");
          } else {
            // Input is a file path
            const resolvedPath = path.resolve(jsonfile);
            console.log(`\nReading metadata from: ${resolvedPath}`);
            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            metadataJson = fileContent.trim();
            JSON.parse(metadataJson); // Validate
          }
          console.log(`Metadata JSON length: ${metadataJson.length} bytes`);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            throw new Error(`Metadata file not found: ${jsonfile}`);
          } else {
            throw new Error(`Invalid JSON in metadata: ${error.message}`);
          }
        }
      }

      // Calculate or use provided data hash
      let finalDataHash: string;
      if (datahash) {
        finalDataHash = datahash;
        console.log(`\nUsing provided data hash: ${finalDataHash}`);
      } else {
        // Auto-calculate hash based on data URL content (or metadata if no URL content available)
        const hashContent = metadataJson || dataurl;
        if (algorithm === "keccak256") {
          finalDataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(hashContent));
        } else if (algorithm === "sha256") {
          const crypto = require('crypto');
          finalDataHash = "0x" + crypto.createHash('sha256').update(hashContent, 'utf8').digest('hex');
        } else {
          throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }
        console.log(`\nAuto-calculated ${algorithm} hash: ${finalDataHash}`);
      }

      // Check if this DID + major version already exists
      try {
        const existingApp = await registry.getApp(did, majorVersion);
        throw new Error(`App with DID "${did}" and major version ${majorVersion} already exists. Owned by: ${existingApp.minter}`);
      } catch (error: any) {
        if (!error.message.includes("App not found")) {
          throw error; // Re-throw if it's not the expected "not found" error
        }
        // "App not found" is what we want - proceed with minting
      }

      console.log("\nMinting app...");
      const tx = await registry.mint(
        did,
        interfacesBitmap,
        dataurl,
        finalDataHash,
        dataHashAlgorithm,
        fungibletokenid,
        contractid,
        majorVersion,
        minorVersion,
        patchVersion,
        traitHashes,
        metadataJson
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      // Extract token ID from events
      const appMintedEvent = receipt?.logs?.find((log: any) => {
        try {
          const parsed = registry.interface.parseLog(log);
          return parsed?.name === "AppMinted";
        } catch {
          return false;
        }
      });
      
      if (appMintedEvent) {
        const parsedEvent = registry.interface.parseLog(appMintedEvent);
        const tokenId = parsedEvent?.args?.tokenId;
        console.log(`\n✅ App minted successfully!`);
        console.log(`Token ID: ${tokenId}`);
        console.log(`DID: ${did}`);
        console.log(`Major Version: ${majorVersion}`);
      }
      
      displayTaskCompletion(true, "App minted successfully");

    } catch (error: any) {
      console.error("Error minting app:", error.message);
      displayTaskCompletion(false, "Failed to mint app");
      throw error;
    }
  });
