import { task } from "hardhat/config";
import { getSecureSigner, verifyBytecode, logTransactionForVerification } from "../shared/signer-utils";

task("deploy-registry", "Deploy only the OMA3 App Registry contract (development only - use Thirdweb Dashboard for production)")
  .setAction(async (taskArgs, hre) => {
    console.log("Note: This is for development/testing only.");
    console.log("For production deployment, use Thirdweb Dashboard for maximum security.");

    const { signer, address: deployerAddress, method } = await getSecureSigner(hre);
    const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry", signer);
    await logTransactionForVerification(hre, OMA3AppRegistry, "OMA3AppRegistry");
    console.log("Deploying OMA3AppRegistry...");
    const registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
    const contractAddress = await registry.getAddress();
    console.log(`✅ OMA3AppRegistry deployed to: ${contractAddress}`);
    await verifyBytecode(hre, contractAddress, "OMA3AppRegistry");
  });


