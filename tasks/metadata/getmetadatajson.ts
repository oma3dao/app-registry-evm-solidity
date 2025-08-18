import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import * as path from 'path';
import { getMetadataContract, displayTaskHeader, displayTaskCompletion } from "../shared/env-helpers";

// Constants for block query limitations
const DEFAULT_MAX_BLOCK_RANGE = 100_000; // 100K blocks is a safe default for most providers
const DEFAULT_CHUNK_SIZE = 25_000;       // Process in 25K block chunks for stability

task("getmetadatajson", "Get metadata JSON for a specific DID")
  .addParam("did", "The DID identifier to query")
  .addOptionalParam("contract", "The address of the deployed metadata contract")
  .addOptionalParam("fromblock", "The starting block number for event query (default: recent)", undefined, types.int)
  .addOptionalParam("toblock", "The ending block number for event query (default: latest)", undefined, types.int)
  .addOptionalParam("maxrange", "Maximum block range to query (default: 100,000)", DEFAULT_MAX_BLOCK_RANGE, types.int)
  .addOptionalParam("output", "Path to save the JSON output file")
  .addFlag("pretty", "Whether to pretty-print the output JSON")
  .addFlag("forcefull", "Force full range query even if it exceeds max range")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, contract, fromblock, toblock, maxrange, output, pretty, forcefull } = taskArgs;
    
    // Get contract instance using the helper
    const { contract: metadata } = await getMetadataContract(hre, contract);
    
    console.log(`\nLooking up metadata for DID: ${did}`);
    
    // Get metadata JSON from contract
    const metadataJson = await metadata.getMetadataJson(did);
    
    if (!metadataJson || metadataJson === "") {
      console.log(`\n❌ No metadata found for DID '${did}'`);
      console.log(`The DID may not be registered, or on-chain metadata may not be stored.`);
      console.log(`Note: This contract only stores metadata if developers chose on-chain storage.`);
      return;
    }
    
    // Parse JSON to validate it and for pretty-printing
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(metadataJson);
    } catch (error: any) {
      console.log(`\n⚠️ Metadata JSON is not valid JSON: ${error.message}`);
      console.log(`Raw metadata content: ${metadataJson}`);
      return;
    }
    
    // Get authorized registry for context
    const authorizedRegistry = await metadata.authorizedRegistry();
    console.log(`Authorized Registry: ${authorizedRegistry}`);
    
    // Determine block range - default to recent blocks if not specified
    const defaultStartBlock = fromblock ?? (await hre.ethers.provider.getBlockNumber()) - 100_000;
    const startBlock = Math.max(defaultStartBlock, 0);
    
    console.log(`Using ${fromblock !== undefined ? 'specified' : 'default recent'} start block: ${startBlock}`);
    
    // Create filter for MetadataSet events (new simplified event)
    const metadataSetFilter = metadata.filters.MetadataSet(did);
    const latestBlock = toblock ?? await hre.ethers.provider.getBlockNumber();
    
    // Check if the range exceeds the maximum
    const blockRange = latestBlock - startBlock;
    const effectiveMaxRange = forcefull ? Number.MAX_SAFE_INTEGER : maxrange;
    
    if (blockRange > effectiveMaxRange && !forcefull) {
      console.log(`\n⚠️ Warning: Block range (${blockRange}) exceeds maximum (${effectiveMaxRange})`);
      console.log(`To avoid RPC provider limitations, the search will be limited to the most recent ${effectiveMaxRange} blocks.`);
      console.log(`Use --forcefull flag to override this limitation, or specify a narrower block range.`);
    }
    
    // Calculate actual range to use based on limitations
    const actualStartBlock = forcefull ? startBlock : Math.max(startBlock, latestBlock - effectiveMaxRange);
    
    console.log(`Querying events from block ${actualStartBlock} to ${latestBlock} (${latestBlock - actualStartBlock} blocks)...`);
    
    // Process in chunks to avoid RPC timeouts
    const metadataSetEvents: any[] = [];
    
    // Process chunks of blocks
    for (let chunkStart = actualStartBlock; chunkStart < latestBlock; chunkStart += DEFAULT_CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + DEFAULT_CHUNK_SIZE - 1, latestBlock);
      
      if (chunkStart > actualStartBlock) {
        process.stdout.write(`.`); // Show progress without too much noise
      }
      
      try {
        // Query each chunk for MetadataSet events
        const metadataChunk = await metadata.queryFilter(metadataSetFilter, chunkStart, chunkEnd);
        
        // Add results to main array
        metadataSetEvents.push(...metadataChunk);
      } catch (error: any) {
        console.log(`\n⚠️ Error querying blocks ${chunkStart}-${chunkEnd}: ${error.message}`);
      }
    }
    
    // Add newline after progress dots
    if (latestBlock - actualStartBlock > DEFAULT_CHUNK_SIZE) {
      console.log('');
    }
    
    // Sort events by block number and log index (descending)
    const allEvents = metadataSetEvents.sort((a: any, b: any) => {
      if (b.blockNumber !== a.blockNumber) {
        return b.blockNumber - a.blockNumber;  // Latest block first
      }
      return (b.logIndex || b.index || 0) - (a.logIndex || a.index || 0);  // Latest log index first
    });
    
    // Display the metadata details
    console.log("\n========== METADATA DETAILS ==========");
    
    // Format JSON for display
    const displayJson = pretty 
      ? JSON.stringify(parsedMetadata, null, 2)
      : JSON.stringify(parsedMetadata);
      
    console.log("\n----- Content -----");
    console.log(displayJson);
    
    if (output) {
      try {
        const resolvedPath = path.resolve(output);
        fs.writeFileSync(
          resolvedPath, 
          pretty ? JSON.stringify(parsedMetadata, null, 2) : metadataJson
        );
        console.log(`\nMetadata saved to: ${resolvedPath}`);
      } catch (error: any) {
        console.error(`\n❌ Failed to save output file: ${error.message}`);
      }
    }
    
    console.log("\n----- Event History -----");
    console.log(`Found ${metadataSetEvents.length} metadata set events.`);
    
    if (allEvents.length > 0) {
      console.log("\nEvent history (newest first):");
      
      for (let i = 0; i < Math.min(allEvents.length, 5); i++) {
        const event = allEvents[i];
        const parsedEvent = metadata.interface.parseLog(event);
        
        if (parsedEvent && parsedEvent.name === "MetadataSet") {
          console.log(`\n  ${i + 1}. MetadataSet Event:`);
          console.log(`     Block: ${event.blockNumber}`);
          console.log(`     Transaction: ${event.transactionHash}`);
          console.log(`     DID: ${parsedEvent.args.did}`);
          console.log(`     Metadata Hash: ${parsedEvent.args.metadataHash}`);
          console.log(`     Timestamp: ${new Date(Number(parsedEvent.args.timestamp) * 1000).toISOString()}`);
          console.log(`     JSON Length: ${parsedEvent.args.metadataJson.length} bytes`);
        }
      }
      
      if (allEvents.length > 5) {
        console.log(`  ... and ${allEvents.length - 5} more events`);
      }
    } else {
      console.log("\nNo events found for this DID in the queried block range.");
      console.log("Note: Events are only available if metadata was set through the registry.");
    }
    
    console.log("\n====================================\n");
  }); 