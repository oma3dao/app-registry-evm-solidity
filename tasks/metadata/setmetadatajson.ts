import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import * as path from 'path';
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

interface TaskArgs {
  did: string;
  major?: string;
  jsonfile?: string;
  hash?: string;
  algorithm?: string;
}

// Task for setting metadata via the registry contract (the proper way)
task("setmetadatajson", "Set app metadata via registry contract")
  .addParam("did", "The DID identifier for the app")
  .addOptionalParam("major", "The major version number", "1")
  .addOptionalParam("jsonfile", "Path to JSON file containing metadata or JSON string", "tasks/metadata/sample-metadata.json")
  .addOptionalParam("hash", "Pre-computed hash of the metadata (will auto-calculate if not provided)")
  .addOptionalParam("algorithm", "Hash algorithm: 'keccak256' or 'sha256'", "keccak256")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, major = "1", jsonfile = "tasks/metadata/sample-metadata.json", hash, algorithm = "keccak256" } = taskArgs;
    const majorVersion = parseInt(major, 10);
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Set App Metadata", hre.network.name, signer.address);
      
      console.log("App DID:", did);
      console.log("Major version:", majorVersion);
      console.log("Hash algorithm:", algorithm);

      // Get registry contract
      const { contract: registry } = await getRegistryContract(hre);

      // Get JSON metadata - either from file or directly from the parameter
      let metadataJson = jsonfile;
      
      // Try to read from file first
      try {
        if (jsonfile.startsWith("{") || jsonfile.startsWith("[")) {
          // Input is already a JSON string
          try {
            // Validate it's valid JSON by parsing and re-stringifying
            metadataJson = JSON.stringify(JSON.parse(jsonfile));
            console.log("Using provided JSON string");
          } catch (error: any) {
            throw new Error(`Invalid JSON string provided: ${error.message}`);
          }
        } else {
          // Input is a file path
          const resolvedPath = path.resolve(jsonfile);
          console.log(`Reading JSON from file: ${resolvedPath}`);
          const fileContent = fs.readFileSync(resolvedPath, 'utf8');
          metadataJson = fileContent.trim();
          
          // Validate JSON from file
          try {
            JSON.parse(metadataJson);
          } catch (error: any) {
            throw new Error(`Invalid JSON in file ${jsonfile}: ${error.message}`);
          }
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`File not found: ${jsonfile}`);
        } else {
          throw error;
        }
      }
      
      console.log(`Metadata JSON length: ${metadataJson.length} bytes`);
      
      // Print a preview of the metadata (truncated if too long)
      const previewLength = 200;
      const preview = metadataJson.length > previewLength 
        ? metadataJson.substring(0, previewLength) + "... (truncated)"
        : metadataJson;
      console.log(`Metadata preview: ${preview}`);
      
      // Calculate hash if not provided
      let dataHash: string;
      let dataHashAlgorithm: number;
      
      if (hash) {
        // Use provided hash
        dataHash = hash;
        dataHashAlgorithm = algorithm === "sha256" ? 1 : 0;
        console.log(`Using provided hash: ${dataHash}`);
      } else {
        // Auto-calculate hash
        console.log(`Auto-calculating ${algorithm} hash...`);
        if (algorithm === "keccak256") {
          dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(metadataJson));
          dataHashAlgorithm = 0;
        } else if (algorithm === "sha256") {
          // Note: Hardhat doesn't have built-in sha256, but we can use ethers
          const crypto = require('crypto');
          dataHash = "0x" + crypto.createHash('sha256').update(metadataJson, 'utf8').digest('hex');
          dataHashAlgorithm = 1;
        } else {
          throw new Error(`Unsupported hash algorithm: ${algorithm}. Use 'keccak256' or 'sha256'`);
        }
        console.log(`Calculated ${algorithm} hash: ${dataHash}`);
      }

      // Check if app exists
      try {
        const app = await registry.getApp(did, majorVersion);
        console.log(`App found - Owner: ${app.minter}`);
        
        // Verify the signer owns this app
        if (app.minter.toLowerCase() !== signer.address.toLowerCase()) {
          throw new Error(`You don't own this app. Owner: ${app.minter}, You: ${signer.address}`);
        }
        
        console.log("✅ Ownership verified. Updating metadata...");
        
      } catch (error: any) {
        if (error.message.includes("App not found")) {
          throw new Error(`App with DID "${did}" and major version ${majorVersion} not found. Register the app first.`);
        } else {
          throw error;
        }
      }

      // Call registry's setMetadataJson function
      console.log("Sending transaction via registry contract...");
      const tx = await registry.setMetadataJson(
        did,
        majorVersion,
        metadataJson,
        dataHash,
        dataHashAlgorithm
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "Metadata updated successfully via registry contract");
      console.log("✅ This tests the real user flow - registry → metadata contract");

    } catch (error: any) {
      console.error("Error setting metadata:", error.message);
      displayTaskCompletion(false, "Failed to set metadata");
      throw error;
    }
  });

// Helper task to register a new app with metadata in one step
task("registerapp", "Register a new app with metadata")
  .addParam("did", "The DID identifier for the app")
  .addParam("interfaces", "Interface bitmap (1=human, 2=api, 4=mcp)", "1")
  .addOptionalParam("dataurl", "Data URL for off-chain metadata", "")
  .addOptionalParam("jsonfile", "Path to JSON file for on-chain metadata", "")
  .addOptionalParam("contractid", "CAIP-10 contract address", "")
  .addOptionalParam("tokenid", "CAIP-19 fungible token ID", "")
  .setAction(async (taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const { did, interfaces, dataurl = "", jsonfile = "", contractid = "", tokenid = "" } = taskArgs;
    
    try {
      const [signer] = await hre.ethers.getSigners();
      displayTaskHeader("Register New App", hre.network.name, signer.address);

      const { contract: registry } = await getRegistryContract(hre);
      
      // Get metadata if provided
      let metadataJson = "";
      let dataHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      
      if (jsonfile) {
        console.log(`Reading metadata from: ${jsonfile}`);
        const resolvedPath = path.resolve(jsonfile);
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        metadataJson = fileContent.trim();
        JSON.parse(metadataJson); // Validate
        
        // Calculate hash
        dataHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(metadataJson));
        console.log(`Metadata hash: ${dataHash}`);
      }

      console.log("Registering app...");
      const tx = await registry.mint(
        did,
        parseInt(interfaces),
        dataurl,
        dataHash,
        0, // keccak256
        tokenid,
        contractid,
        1, // major version
        0, // minor version  
        0, // patch version
        [], // keyword hashes
        metadataJson
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "App registered successfully with metadata");

    } catch (error: any) {
      console.error("Error registering app:", error.message);
      displayTaskCompletion(false, "Failed to register app");
      throw error;
    }
  });