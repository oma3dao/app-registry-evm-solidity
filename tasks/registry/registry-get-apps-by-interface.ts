import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("registry:get-apps-by-interface", "Get apps filtered by interface type")
  .addParam("address", "Registry contract address")
  .addParam("interface", "Interface mask (1=Human, 2=API, 4=Contract, or comma-separated like '1,2' or names like 'human,api')")
  .addOptionalParam("start", "Starting index for pagination", "0")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;

    // Parse interface parameter
    let interfaceMask: number;
    const interfaceInput = taskArgs.interface.toLowerCase();
    
    // Check if it's a name or number
    if (interfaceInput.includes(',')) {
      // Multiple interfaces specified
      const parts = interfaceInput.split(',').map((s: string) => s.trim());
      interfaceMask = 0;
      for (const part of parts) {
        if (part === 'human' || part === '1') {
          interfaceMask |= 1;
        } else if (part === 'api' || part === '2') {
          interfaceMask |= 2;
        } else if (part === 'contract' || part === 'smartcontract' || part === '4') {
          interfaceMask |= 4;
        } else {
          throw new Error(`Unknown interface: ${part}`);
        }
      }
    } else {
      // Single interface
      if (interfaceInput === 'human' || interfaceInput === '1') {
        interfaceMask = 1;
      } else if (interfaceInput === 'api' || interfaceInput === '2') {
        interfaceMask = 2;
      } else if (interfaceInput === 'contract' || interfaceInput === 'smartcontract' || interfaceInput === '4') {
        interfaceMask = 4;
      } else if (interfaceInput === 'all' || interfaceInput === '7') {
        interfaceMask = 7;
      } else {
        // Try parsing as number
        interfaceMask = parseInt(interfaceInput);
        if (isNaN(interfaceMask) || interfaceMask < 0 || interfaceMask > 7) {
          throw new Error(`Invalid interface mask: ${interfaceInput}`);
        }
      }
    }

    const registryAddress = taskArgs.address;
    const startIndex = parseInt(taskArgs.start);

    console.log(`\n📱 Getting apps by interface from: ${registryAddress}`);
    console.log(`🔍 Interface mask: ${interfaceMask} (${getInterfaceNames(interfaceMask)})`);
    console.log(`📄 Starting at index: ${startIndex}\n`);

    const registry = await ethers.getContractAt("OMA3AppRegistry", registryAddress);
    
    try {
      const result = await registry.getAppsByInterface(interfaceMask, startIndex);
      const apps = result[0];
      const nextStartIndex = result[1];

      console.log(`✅ Found ${apps.length} apps matching interface mask\n`);

      if (apps.length === 0) {
        console.log("No apps found matching this interface.");
        return;
      }

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        console.log(`\n📱 App #${i + 1}:`);
        console.log(`   Token ID: ${app.tokenId}`);
        console.log(`   Name: ${app.name}`);
        console.log(`   DID Hash: ${app.didHash}`);
        console.log(`   Interfaces: ${app.interfaces} (${getInterfaceNames(app.interfaces)})`);
        console.log(`   Status: ${getStatusName(app.status)}`);
        console.log(`   Data URL: ${app.dataUrl}`);
      }

      console.log(`\n${'─'.repeat(60)}`);
      if (nextStartIndex > 0) {
        console.log(`\n📄 More results available. Next start index: ${nextStartIndex}`);
        console.log(`Run with --start ${nextStartIndex} to get next page`);
      } else {
        console.log(`\n✅ End of results`);
      }
    } catch (error: any) {
      console.error("❌ Error fetching apps:", error.message);
      throw error;
    }
  });

function getInterfaceNames(mask: number): string {
  const names: string[] = [];
  if (mask & 1) names.push("Human");
  if (mask & 2) names.push("API");
  if (mask & 4) names.push("Smart Contract");
  return names.length > 0 ? names.join(", ") : "None";
}

function getStatusName(status: number): string {
  const statusNames = ["Active", "Suspended", "Disabled", "Deprecated"];
  return statusNames[status] || `Unknown (${status})`;
}

