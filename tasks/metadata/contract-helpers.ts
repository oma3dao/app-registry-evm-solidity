import { HardhatRuntimeEnvironment } from "hardhat/types";
import { OMA3AppMetadataV0 } from "../typechain-types";
import config from "../config/default";

/**
 * Get an instance of the OMA3AppMetadataV0 contract
 * 
 * @param hre Hardhat Runtime Environment
 * @param contractAddress Optional contract address, will try to get from config if not provided
 * @param signer Optional signer to use for the contract
 * @returns Contract instance and address
 */
export async function getMetadataContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress?: string,
  signer?: any
): Promise<{ contract: OMA3AppMetadataV0, address: string }> {
  let resolvedAddress = contractAddress;
  
  // If not provided as parameter, get from config based on current network
  if (!resolvedAddress) {
    const networkName = hre.network.name;
    const defaultAddress = config.contracts[networkName]?.OMA3AppMetadataV0;
    
    if (defaultAddress && defaultAddress !== "") {
      resolvedAddress = defaultAddress;
      console.log(`Using default contract address for network '${networkName}'`);
    }
  }
  
  if (!resolvedAddress) {
    throw new Error(
      "Contract address not provided. Use one of these options:\n" +
      "1. --contract parameter\n" +
      `2. Add a default address for network '${hre.network.name}' in config/default.ts`
    );
  }
  
  console.log(`Using contract at: ${resolvedAddress}`);
  
  // Get contract with or without signer
  const contract = signer
    ? await hre.ethers.getContractAt("OMA3AppMetadataV0", resolvedAddress, signer) as OMA3AppMetadataV0
    : await hre.ethers.getContractAt("OMA3AppMetadataV0", resolvedAddress) as OMA3AppMetadataV0;
    
  return { contract, address: resolvedAddress };
}

/**
 * Get the deployment block for a given DID
 * 
 * @param hre Hardhat Runtime Environment
 * @param did The DID to lookup
 * @returns The block number where the DID was registered
 */
export async function getDeploymentBlockForDID(
  hre: HardhatRuntimeEnvironment,
  did: string
): Promise<number> {
  // TODO: In the future, this will query the OMA3AppRegistry contract
  // For now, return a safe, reasonably recent block number as a placeholder
  
  const networkName = hre.network.name;
  
  // Different defaults for different networks
  switch (networkName) {
    case 'mainnet':
      return 20000000;
    case 'sepolia':
      return 8000000;
    case 'celoAlfajores':
      return 44000000;
    default:
      // For local development and other networks
      // Start from a reasonable point in the past instead of block 0
      // This can be overridden with the --fromblock parameter
      const latestBlock = await hre.ethers.provider.getBlockNumber();
      return Math.max(0, latestBlock - 1000); // Last 1000 blocks or 0
  }
  
  /* 
  Future implementation example:
  
  // Get the OMA3AppRegistry contract instance
  const registryAddress = config.contracts[networkName]?.OMA3AppRegistry;
  if (!registryAddress) {
    console.log("Warning: OMA3AppRegistry address not found in config, using fallback block");
    return fallbackBlock;
  }
  
  const registry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress);
  
  try {
    // Call the registry contract to get the registration block
    const registrationBlock = await registry.getRegistrationBlockForDID(did);
    return registrationBlock.toNumber();
  } catch (error) {
    console.log(`Error getting registration block from registry: ${error.message}`);
    return fallbackBlock;
  }
  */
}

/**
 * Parse event logs from contract events
 * 
 * @param event The event object to parse
 * @param contractInterface The contract interface to use for parsing
 * @returns The parsed log object or null if parsing failed
 */
export function parseEventLog(event: any, contractInterface: any): any {
  try {
    const parsedLog = contractInterface.parseLog({
      topics: event.topics,
      data: event.data
    });
    return parsedLog;
  } catch (error: any) {
    console.log(`\n⚠️ Error parsing event log: ${error.message}`);
    return null;
  }
}

/**
 * Determine the event type from an event object
 * 
 * @param event The event object
 * @param registeredEvents Array of registered events for comparison
 * @param updatedEvents Array of updated events for comparison 
 * @returns The event type string
 */
export function getEventType(event: any, registeredEvents: any[], updatedEvents: any[]): string {
  if (event.eventName) {
    return event.eventName;
  }
  
  if (registeredEvents.includes(event)) {
    return "MetadataRegisteredJson";
  }
  
  if (updatedEvents.includes(event)) {
    return "MetadataUpdatedJson";
  }
  
  return "Unknown";
}

/**
 * Print details of an event in a formatted way
 * 
 * @param event The event object to display
 * @param contractInterface The contract interface to use for parsing
 * @param did The DID identifier associated with the event
 * @param index Optional index for numbered display in a timeline
 * @param isDetailed Whether to show detailed output
 */
export function printEventDetails(
  event: any, 
  contractInterface: any,
  did: string,
  registeredEvents: any[],
  updatedEvents: any[],
  index?: number, 
  isDetailed: boolean = true
): void {
  const eventType = getEventType(event, registeredEvents, updatedEvents);
  const parsedLog = parseEventLog(event, contractInterface);
  
  if (!parsedLog) {
    return;
  }
  
  const args = parsedLog.args;
  
  if (index !== undefined) {
    console.log(`  ${index}. Block #${event.blockNumber}: ${eventType}`);
    console.log(`     Tx: ${event.transactionHash}`);
  } else {
    console.log(`Latest Event: ${eventType}`);
    console.log(`Block: ${event.blockNumber}`);
    console.log(`Transaction: ${event.transactionHash}`);
  }
  
  if (args) {
    if (isDetailed) {
      console.log(index !== undefined ? "     Event Arguments:" : "\nEvent Arguments:");
      
      // The DID might be an indexed parameter which comes as an object
      // For indexed string parameters in events, we already know the value from the task parameter
      console.log(index !== undefined ? "     - did: " + did : "  did: " + did);
      
      if (args.owner) {
        console.log(index !== undefined ? "     - owner: " + args.owner.toString() : "  owner: " + args.owner.toString());
      }
      
      if (args.metadataHash) {
        console.log(index !== undefined ? "     - metadataHash: " + args.metadataHash.toString() : "  metadataHash: " + args.metadataHash.toString());
      }
      
      if (args.timestamp) {
        const timestamp = Number(args.timestamp);
        console.log(index !== undefined 
          ? `     - timestamp: ${timestamp} (${new Date(timestamp * 1000).toLocaleString()})` 
          : `  timestamp: ${timestamp} (${new Date(timestamp * 1000).toLocaleString()})`);
      }
      
      if (args.metadataJson) {
        // Get the JSON value
        const jsonValue = args.metadataJson.toString();
        
        try {
          // Try to parse and pretty-print the JSON
          const parsedJson = JSON.parse(jsonValue);
          
          if (index !== undefined) {
            console.log("     - metadataJson:");
            // Format for timeline view with proper indentation
            const formattedJson = JSON.stringify(parsedJson, null, 6)
              .split('\n')
              .map((line, i) => i === 0 ? line : "       " + line)
              .join('\n');
            console.log(formattedJson);
          } else {
            console.log("  metadataJson:");
            // Format for single event view with proper indentation
            const formattedJson = JSON.stringify(parsedJson, null, 2)
              .split('\n')
              .map((line, i) => i === 0 ? line : "  " + line)
              .join('\n');
            console.log(formattedJson);
          }
        } catch (error: any) {
          // If it's not valid JSON or there's another error, fall back to truncated display
          const truncated = jsonValue.length > 100 
            ? jsonValue.substring(0, 100) + "... [truncated, full length: " + jsonValue.length + " chars]" 
            : jsonValue;
          console.log(index !== undefined ? "     - metadataJson: " + truncated : "  metadataJson: " + truncated);
        }
      }
    } else {
      // Simple display mode for timeline
      if (args.metadataHash) {
        console.log(`     Hash: ${args.metadataHash.toString()}`);
      }
      if (args.timestamp) {
        const timestamp = Number(args.timestamp);
        console.log(`     Time: ${new Date(timestamp * 1000).toLocaleString()}`);
      }
      if (args.owner) {
        console.log(`     Owner: ${args.owner.toString()}`);
      }
    }
  }
  
  if (index !== undefined) {
    console.log(""); // Empty line between events
  }
} 