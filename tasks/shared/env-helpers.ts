import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NETWORK_CONTRACTS } from "../../hardhat.config";

/**
 * Get a required environment variable
 * @param name Environment variable name
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
      `Please set it to the deployed contract address.`
    );
  }
  return value;
}

/**
 * Get network-specific contract addresses from network contracts config
 * @param hre Hardhat Runtime Environment
 * @returns Object with registry and metadata contract addresses
 */
export function getContractAddresses(hre: HardhatRuntimeEnvironment) {
  const networkName = hre.network.name;
  const contractConfig = NETWORK_CONTRACTS[networkName as keyof typeof NETWORK_CONTRACTS];
  
  if (!contractConfig) {
    throw new Error(
      `No contract addresses configured for network ${networkName}. ` +
      `Please add an entry to NETWORK_CONTRACTS in hardhat.config.ts`
    );
  }
  
  const { registry, metadata } = contractConfig;
  
  if (!registry || registry === "0x") {
    throw new Error(
      `Registry address not deployed on network ${networkName}. ` +
      `Please deploy contracts and update NETWORK_CONTRACTS.${networkName}.registry in hardhat.config.ts`
    );
  }
  
  if (!metadata || metadata === "0x") {
    throw new Error(
      `Metadata address not deployed on network ${networkName}. ` +
      `Please deploy contracts and update NETWORK_CONTRACTS.${networkName}.metadata in hardhat.config.ts`
    );
  }
  
  return { registry, metadata };
}

/**
 * Get a contract instance for the registry
 * @param hre Hardhat Runtime Environment
 * @param address Optional contract address (will use network-specific env var if not provided)
 * @returns Registry contract instance
 */
export async function getRegistryContract(hre: HardhatRuntimeEnvironment, address?: string) {
  const contractAddress = address || getContractAddresses(hre).registry;
  console.log(`Registry contract address (${hre.network.name}):`, contractAddress);
  
  const contract = await hre.ethers.getContractAt("OMA3AppRegistry", contractAddress);
  return { contract, address: contractAddress };
}

/**
 * Get a contract instance for the metadata contract
 * @param hre Hardhat Runtime Environment
 * @param address Optional contract address (will use network-specific env var if not provided)
 * @returns Metadata contract instance
 */
export async function getMetadataContract(hre: HardhatRuntimeEnvironment, address?: string) {
  const contractAddress = address || getContractAddresses(hre).metadata;
  console.log(`Metadata contract address (${hre.network.name}):`, contractAddress);
  
  const contract = await hre.ethers.getContractAt("OMA3AppMetadata", contractAddress);
  return { contract, address: contractAddress };
}

/**
 * Display standard task header
 * @param taskName Name of the task being executed
 * @param network Current network name
 * @param account Account being used
 */
export function displayTaskHeader(taskName: string, network: string, account: string) {
  console.log(`\n=== ${taskName} ===`);
  console.log(`Network: ${network}`);
  console.log(`Account: ${account}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
}

/**
 * Display task completion
 * @param success Whether the task was successful
 * @param message Optional completion message
 */
export function displayTaskCompletion(success: boolean, message?: string) {
  const status = success ? "✅ SUCCESS" : "❌ FAILED";
  console.log(`\n${status}: ${message || "Task completed"}\n`);
}
