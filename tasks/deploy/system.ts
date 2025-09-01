import { task } from "hardhat/config";
import { runSystemDeployment } from "../shared/deploySystem";

task("deploy-system", "Deploy the OMA3 App Registry + Metadata system (development only - use Thirdweb Dashboard for production)")
  .addFlag("noLink", "Skip linking Registry and Metadata contracts")
  .addFlag("noTest", "Skip integration test after deployment (default is to test)")
  .setAction(async (taskArgs, hre) => {
    console.log("Note: This is for development/testing only.");
    console.log("For production deployment, use Thirdweb Dashboard for maximum security.");
    
    await runSystemDeployment(hre, {
      shouldLinkContracts: !Boolean(taskArgs.noLink),
      testConnection: !Boolean(taskArgs.noTest)
    });
  });


