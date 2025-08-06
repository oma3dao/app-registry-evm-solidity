const { task } = require("hardhat/config");

task("get-apps", "Fetches active applications with pagination")
  .addParam("startfrom", "The index to start fetching from (use 0 for the first call)", "0", undefined, true)
  .setAction(async (taskArgs, hre) => {
    const startFromIndex = parseInt(taskArgs.startfrom, 10);
    const [deployer] = await hre.ethers.getSigners();
    console.log("Fetching active apps, starting from index:", startFromIndex);
    console.log("Using account:", deployer.address);

    const registryAddress = process.env.APP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      console.error("APP_REGISTRY_ADDRESS environment variable not set.");
      process.exit(1);
    }
    console.log("AppRegistry contract address:", registryAddress);

    const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress);

    try {
      const { apps, nextStartIndex } = await appRegistry.getApps(startFromIndex);
      console.log(`Found ${apps.length} active application(s):`);
      apps.forEach((app, index) => {
        console.log(`\nApplication ${index + 1}:`);
        console.log("  DID:", app.did);
        console.log("  Major Version:", app.versionMajor);
        console.log("  Interfaces:", app.interfaces.toString());
        console.log("  Data URL:", app.dataUrl);
        console.log("  Data Hash:", app.dataHash);
        console.log("  Data Hash Algorithm:", app.dataHashAlgorithm.toString());
        console.log("  Fungible Token ID:", app.fungibleTokenId);
        console.log("  Contract ID:", app.contractId);
        console.log("  Minter:", app.minter);
        console.log("  Status:", app.status.toString()); // Should be 0 (ACTIVE)
        console.log("  Keyword Hashes:", app.keywordHashes.length, "keywords");
      });

      if (nextStartIndex.toString() !== "0") {
        console.log(`\nNext index for pagination: ${nextStartIndex.toString()}`);
        console.log("To get the next page, use: --startfrom", nextStartIndex.toString());
      } else {
        console.log("\nNo more active applications to fetch.");
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      process.exit(1);
    }
  });

module.exports = {}; 