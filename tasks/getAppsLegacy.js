const { task } = require("hardhat/config");

task("get-apps-legacy", "Fetches active applications with pagination (Legacy Contract)")
  .addParam("startfrom", "The token ID to start fetching from (use 1 for the first call)", "1", undefined, true)
  .setAction(async (taskArgs, hre) => {
    const startFromTokenId = parseInt(taskArgs.startfrom, 10);
    const [deployer] = await hre.ethers.getSigners();
    console.log("Fetching active apps, starting from token ID:", startFromTokenId);
    console.log("Using account:", deployer.address);

    const registryAddress = process.env.APP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      console.error("APP_REGISTRY_ADDRESS environment variable not set.");
      process.exit(1);
    }
    console.log("AppRegistry contract address:", registryAddress);

    const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistryLegacy", registryAddress);

    try {
      const { apps, nextTokenId } = await appRegistry.getApps(startFromTokenId);
      console.log(`Found ${apps.length} active application(s):`);
      apps.forEach((app, index) => {
        console.log(`\nApplication ${index + 1} (Token ID will vary based on actual minting order and status):`);
        console.log("  Name:", hre.ethers.utils.parseBytes32String(app.name));
        console.log("  Version:", hre.ethers.utils.parseBytes32String(app.version));
        console.log("  DID:", app.did);
        console.log("  Data URL:", app.dataUrl);
        console.log("  IWPS Portal URI:", app.iwpsPortalUri);
        console.log("  Agent API URI:", app.agentApiUri);
        console.log("  Contract Address:", app.contractAddress);
        console.log("  Minter:", app.minter);
        console.log("  Status:", app.status.toString()); // Should be 0 (ACTIVE)
        console.log("  Has Contract:", app.hasContract);
      });

      if (nextTokenId.toString() !== "0") {
        console.log(`\nNext token ID for pagination: ${nextTokenId.toString()}`);
      } else {
        console.log("\nNo more active applications to fetch.");
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      process.exit(1);
    }
  });

module.exports = {}; 