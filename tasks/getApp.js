const { task } = require("hardhat/config");

task("get-app", "Fetches an application by its DID and major version")
  .addParam("did", "The Decentralized Identifier of the application")
  .addParam("major", "The major version number", "1", undefined, true)
  .setAction(async (taskArgs, hre) => {
    const { did, major } = taskArgs;
    const majorVersion = parseInt(major, 10);
    const [deployer] = await hre.ethers.getSigners();
    console.log("Fetching app for DID:", did, "Major version:", majorVersion);
    console.log("Using account:", deployer.address);

    const registryAddress = process.env.APP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      console.error("APP_REGISTRY_ADDRESS environment variable not set.");
      process.exit(1);
    }
    console.log("AppRegistry contract address:", registryAddress);

    const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress);

    try {
      const app = await appRegistry.getApp(did, majorVersion);
      console.log("Application Details:");
      console.log("  DID:", app.did);
      console.log("  Major Version:", app.versionMajor);
      console.log("  Interfaces:", app.interfaces.toString());
      console.log("  Data URL:", app.dataUrl);
      console.log("  Data Hash:", app.dataHash);
      console.log("  Data Hash Algorithm:", app.dataHashAlgorithm.toString());
      console.log("  Fungible Token ID:", app.fungibleTokenId);
      console.log("  Contract ID:", app.contractId);
      console.log("  Minter:", app.minter);
      console.log("  Status:", app.status.toString()); // 0: ACTIVE, 1: DEPRECATED, 2: REPLACED
      console.log("  Token ID:", app.tokenId ? app.tokenId.toString() : "N/A");
      console.log("  Keyword Hashes:", app.keywordHashes.length, "keywords");
      if (app.keywordHashes.length > 0) {
        app.keywordHashes.forEach((hash, index) => {
          console.log(`    ${index + 1}: ${hash}`);
        });
      }
    } catch (error) {
      console.error("Error fetching application:", error);
      process.exit(1);
    }
  });

module.exports = {}; 