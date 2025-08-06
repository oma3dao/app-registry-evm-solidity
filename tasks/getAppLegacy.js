const { task } = require("hardhat/config");

task("get-app-legacy", "Fetches an application by its DID (Legacy Contract)")
  .addParam("did", "The Decentralized Identifier of the application")
  .setAction(async (taskArgs, hre) => {
    const { did } = taskArgs;
    const [deployer] = await hre.ethers.getSigners();
    console.log("Fetching app for DID:", did);
    console.log("Using account:", deployer.address);

    const registryAddress = process.env.APP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      console.error("APP_REGISTRY_ADDRESS environment variable not set.");
      process.exit(1);
    }
    console.log("AppRegistry contract address:", registryAddress);

    const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistryLegacy", registryAddress);

    try {
      const app = await appRegistry.getApp(did);
      console.log("Application Details:");
      console.log("  Name:", hre.ethers.utils.parseBytes32String(app.name));
      console.log("  Version:", hre.ethers.utils.parseBytes32String(app.version));
      console.log("  DID:", app.did);
      console.log("  Data URL:", app.dataUrl);
      console.log("  IWPS Portal URI:", app.iwpsPortalUri);
      console.log("  Agent API URI:", app.agentApiUri);
      console.log("  Contract Address:", app.contractAddress);
      console.log("  Minter:", app.minter);
      console.log("  Status:", app.status.toString()); // 0: ACTIVE, 1: DEPRECATED, 2: REPLACED
      console.log("  Has Contract:", app.hasContract);
    } catch (error) {
      console.error("Error fetching application:", error);
      process.exit(1);
    }
  });

module.exports = {}; 