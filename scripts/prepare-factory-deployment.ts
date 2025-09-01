import { ethers } from "hardhat";

/**
 * Preparation script for Thirdweb Dashboard deployment
 * This script compiles contracts and provides deployment instructions
 */
async function main() {
  console.log("🏭 Preparing OMA3 System Factory for Thirdweb Dashboard Deployment");
  console.log("================================================================\n");

  // Compile contracts to ensure artifacts are up to date
  console.log("📦 Compiling contracts...");
  await hre.run("compile");
  console.log("✅ Contracts compiled successfully\n");

  console.log("📋 **Thirdweb Dashboard Deployment Steps:**");
  console.log("1. Go to: https://thirdweb.com/contracts/deploy");
  console.log("2. Upload the following contract artifact:");
  console.log("   📁 artifacts/contracts/OMA3SystemFactory.sol/OMA3SystemFactory.json");
  console.log("3. Deploy OMA3SystemFactory with no constructor parameters");
  console.log("4. After deployment, call deploySystem(0) to deploy both contracts\n");

  console.log("🔮 **Address Prediction:**");
  console.log("You can predict deployment addresses before deploying by calling:");
  console.log("factory.predictAddresses(yourWallet, 0)");
  console.log("This returns the addresses where Registry and Metadata will be deployed\n");

  console.log("🔗 **What the Factory Does:**");
  console.log("- ✅ Deploys OMA3AppRegistry using CREATE2");
  console.log("- ✅ Deploys OMA3AppMetadata using CREATE2"); 
  console.log("- ✅ Links Registry → Metadata");
  console.log("- ✅ Links Metadata → Registry");
  console.log("- ✅ Transfers ownership to you");
  console.log("- ✅ Emits deployment event with all addresses\n");

  console.log("🎯 **Result:**");
  console.log("You get a fully deployed and linked OMA3 system with:");
  console.log("- Registry contract (you own it)");
  console.log("- Metadata contract (you own it)");
  console.log("- Both contracts know about each other");
  console.log("- Ready for production use\n");

  console.log("🚀 **Production Deployment Workflow:**");
  console.log("1. Deploy factory via Thirdweb Dashboard");
  console.log("2. Call factory.deploySystem(0) via Dashboard");
  console.log("3. Note the registry and metadata addresses from the event");
  console.log("4. Verify both contracts on the blockchain explorer");
  console.log("5. Done! Your system is live and secure\n");

  console.log("✨ **Security Benefits:**");
  console.log("- 🔒 No local private key exposure");
  console.log("- 🔒 No supply chain attack risks"); 
  console.log("- 🔒 Hardware wallet signing via Thirdweb");
  console.log("- 🔒 Professional deployment infrastructure");
  console.log("- 🔒 Deterministic, verifiable addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
