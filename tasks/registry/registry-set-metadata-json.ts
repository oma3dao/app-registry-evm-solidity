import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import * as path from 'path';
import { getRegistryContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";
import { getUserSigner } from "../shared/signer-utils";

interface TaskArgs {
  did: string;
  major?: string;
  minor?: string;
  patch?: string;
  jsonfile?: string;
  hash?: string;
  algorithm?: string;
}

task("set-metadata-json", "Set metadata JSON for an existing app via registry contract (updates versionHistory)")
  .addParam("did", "The DID identifier for the app")
  .addOptionalParam("major", "The major version number", "1")
  .addOptionalParam("minor", "The minor version number (creates new version entry)", "0")
  .addOptionalParam("patch", "The patch version number (creates new version entry)", "0")
  .addOptionalParam("jsonfile", "Path to JSON file containing metadata or JSON string", "tasks/samples/sample-metadata-human.json")
  .addOptionalParam("hash", "Pre-computed hash of the metadata (will auto-calculate if not provided)")
  .addOptionalParam("algorithm", "Hash algorithm: 'keccak256' or 'sha256'", "keccak256")
  .addOptionalParam("signerFileName", "~/.ssh/<file> containing hex private key")
  .setAction(async (taskArgs: TaskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, major = "1", minor = "0", patch = "0", jsonfile = "tasks/samples/sample-metadata-human.json", hash, algorithm = "keccak256" } = taskArgs;
    const majorVersion = parseInt(major, 10);
    const minorVersion = parseInt(minor, 10);
    const patchVersion = parseInt(patch, 10);
    
    try {
      const { signer, address } = await getUserSigner(hre, taskArgs as any);
      displayTaskHeader("Set App Metadata", hre.network.name, address);
      
      console.log("App DID:", did);
      console.log("Version:", `${majorVersion}.${minorVersion}.${patchVersion}`);
      console.log("Hash algorithm:", algorithm);
      console.log("\nNote: This will add version", `${majorVersion}.${minorVersion}.${patchVersion}`, "to versionHistory");

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
          const crypto = require('crypto');
          dataHash = "0x" + crypto.createHash('sha256').update(metadataJson, 'utf8').digest('hex');
          dataHashAlgorithm = 1;
        } else {
          throw new Error(`Unsupported hash algorithm: ${algorithm}. Use 'keccak256' or 'sha256'`);
        }
        console.log(`Calculated ${algorithm} hash: ${dataHash}`);
      }

      // Check if app exists and verify ownership
      try {
        const app = await registry.getApp(did, majorVersion);
        console.log(`App found - Owner: ${app.minter}`);
        
        // Verify the signer owns this app
        if (app.minter.toLowerCase() !== address.toLowerCase()) {
          throw new Error(`You don't own this app. Owner: ${app.minter}, You: ${address}`);
        }
        
        console.log("✅ Ownership verified. Setting metadata...");
        
      } catch (error: any) {
        if (error.message.includes("App not found")) {
          throw new Error(`App with DID "${did}" and major version ${majorVersion} not found. Mint the app first using the 'mint' task.`);
        } else {
          throw error;
        }
      }

      // Call registry's setMetadataJson function (new signature with version components)
      console.log("Sending transaction via registry contract...");
      const tx = await registry.setMetadataJson(
        did,
        majorVersion,
        minorVersion,
        patchVersion,
        metadataJson,
        dataHash,
        dataHashAlgorithm
      );
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
      
      displayTaskCompletion(true, "Metadata set successfully via registry contract");
      console.log("✅ Metadata stored on-chain through the metadata contract");

    } catch (error: any) {
      console.error("Error setting metadata:", error.message);
      displayTaskCompletion(false, "Failed to set metadata");
      throw error;
    }
  });
