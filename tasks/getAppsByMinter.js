const { task } = require("hardhat/config");

task("get-apps-by-minter", "Fetches all applications minted by a specific address")
  .addParam("minter", "The address of the minter")
  .setAction(async (taskArgs, hre) => {
    const { minter } = taskArgs;
    console.log("Fetching apps for minter:", minter);

    const signers = await hre.ethers.getSigners();
    if (signers && signers.length > 0) {
      const deployer = signers[0];
      console.log("Using account (if available for signing):", deployer.address);
    } else {
      console.log("No specific signer account configured for this network, proceeding with read-only call.");
    }

    const registryAddress = process.env.APP_REGISTRY_ADDRESS;
    if (!registryAddress) {
      console.error("APP_REGISTRY_ADDRESS environment variable not set.");
      process.exit(1);
    }
    console.log("AppRegistry contract address:", registryAddress);

    // Check if there is code at the address on the current network
    const code = await hre.ethers.provider.getCode(registryAddress);
    if (code === "0x" || code === "0x0") {
      console.error(`No contract code found at ${registryAddress} on the currently targeted network.`);
      console.error("Please ensure that APP_REGISTRY_ADDRESS is correct and you are targeting the correct network with --network <your-network-name>.");
      process.exit(1);
    }
    console.log(`Contract code found at ${registryAddress}. Proceeding...`);

    const appRegistry = await hre.ethers.getContractAt("OMA3AppRegistry", registryAddress);

    try {
      const apps = await appRegistry.getAppsByMinter(minter);
      console.log("Raw 'apps' variable from contract call:", apps);

      console.log(`Found ${apps.length} application(s) for minter ${minter}:`);
      apps.forEach((app, index) => {
        console.log(`\nApplication ${index + 1}:`);
        console.log("  Name:", hre.ethers.utils.parseBytes32String(app.name));
        console.log("  Version:", hre.ethers.utils.parseBytes32String(app.version));
        console.log("  DID:", app.did);
        console.log("  Data URL:", app.dataUrl);
        console.log("  IWPS Portal URI:", app.iwpsPortalUri);
        console.log("  Agent API URI:", app.agentApiUri);
        console.log("  Contract Address:", app.contractAddress);
        console.log("  Minter:", app.minter);
        console.log("  Status:", app.status.toString());
        console.log("  Has Contract:", app.hasContract);
      });
    } catch (error) {
      console.error("Error fetching applications by minter. Details:");
      console.error("  Message:", error.message);
      if (error.code) console.error("  Code:", error.code);
      if (error.reason) console.error("  Reason:", error.reason);
      if (error.transactionHash) console.error("  Transaction Hash:", error.transactionHash);
      if (error.data) console.error("  Data (revert reason may be here if it's a custom error):", error.data);
      process.exit(1);
    }
  });

module.exports = {}; 