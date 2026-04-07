import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";

/**
 * Task: update-frontend-abis
 * 
 * Copies compiled contract ABIs from artifacts to the frontend application.
 * This is CRITICAL after every contract deployment or modification.
 * 
 * Usage:
 *   npx hardhat update-frontend-abis
 * 
 * What it does:
 *   - Copies OMA3AppRegistry.json to app-registry-frontend/src/abi/appRegistry.json
 *   - Copies OMA3AppMetadata.json to app-registry-frontend/src/abi/appMetadata.json
 *   - Copies OMA3ResolverWithStore.json to app-registry-frontend/src/abi/resolver.json
 * 
 * Why this matters:
 *   - Frontend needs updated ABIs to call new contract functions
 *   - Missing this step causes "Invalid ABI parameter" errors
 *   - ERC-8004 register() function won't work without updated ABI
 */
task("update-frontend-abis", "Update frontend ABI files from compiled artifacts")
  .addParam("targetPath", "Relative path to frontend directory (e.g., ../app-registry-frontend)")
  .setAction(async (taskArgs, hre) => {
    console.log("\n📦 Updating Frontend ABIs...\n");

    const frontendPath = taskArgs.targetPath;
    console.log(`Target path: ${frontendPath}\n`);

    // Define source and destination paths
    const contracts = [
      {
        name: "OMA3AppRegistry",
        source: "artifacts/contracts/identity/OMA3AppRegistry.sol/OMA3AppRegistry.json",
        dest: `${frontendPath}/src/abi/appRegistry.json`,
      },
      {
        name: "OMA3AppMetadata",
        source: "artifacts/contracts/identity/OMA3AppMetadata.sol/OMA3AppMetadata.json",
        dest: `${frontendPath}/src/abi/appMetadata.json`,
      },
      {
        name: "OMA3ResolverWithStore",
        source: "artifacts/contracts/identity/OMA3ResolverWithStore.sol/OMA3ResolverWithStore.json",
        dest: `${frontendPath}/src/abi/resolver.json`,
      },
    ];

    let successCount = 0;
    let failCount = 0;

    // Process each contract
    for (const contract of contracts) {
      try {
        // Check if source exists
        if (!fs.existsSync(contract.source)) {
          console.log(`⚠️  ${contract.name}: Source not found (${contract.source})`);
          console.log(`   Run 'npm run compile' first\n`);
          failCount++;
          continue;
        }

        // Check if destination directory exists
        const destDir = path.dirname(contract.dest);
        if (!fs.existsSync(destDir)) {
          console.log(`⚠️  ${contract.name}: Destination directory not found (${destDir})`);
          console.log(`   Make sure app-registry-frontend is in the parent directory\n`);
          failCount++;
          continue;
        }

        // Copy the file
        fs.copyFileSync(contract.source, contract.dest);
        console.log(`✅ ${contract.name}: Updated successfully`);
        successCount++;
      } catch (error) {
        console.log(`❌ ${contract.name}: Failed to update`);
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
        failCount++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log(`Summary: ${successCount} updated, ${failCount} failed`);
    console.log("=".repeat(60));

    if (successCount > 0) {
      console.log("\n✅ Frontend ABIs updated successfully!");
      console.log("\nNext steps:");
      console.log("  1. Restart the frontend development server if running");
      console.log("  2. Test contract interactions in the frontend");
      console.log("  3. Verify new functions are available (e.g., ERC-8004 register())");
    }

    if (failCount > 0) {
      console.log("\n⚠️  Some ABIs failed to update. Check the errors above.");
      process.exit(1);
    }

    console.log("");
  });
