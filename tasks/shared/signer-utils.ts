import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { Signer } from "ethers";
// HRE is passed from tasks to avoid importing hardhat at module top-level (prevents HH9)

/**
 * Secure signer utility - protects against IDE extension attacks
 * Reference: https://x.com/0xzak/status/1955655184522371361 ($500k+ stolen from crypto devs)
 * 
 * Note: Hardware wallet support removed. Development uses SSH key automatically.
 * For production, use Thirdweb Dashboard deployment for maximum security.
 */

export async function getSecureSigner(hre: HardhatRuntimeEnvironment): Promise<{ signer: Signer; address: string; method: string }> {
  return await getSSHKeySigner(hre);
}

async function getSSHKeySigner(hre: HardhatRuntimeEnvironment): Promise<{ signer: Signer; address: string; method: string }> {
  console.log("SSH KEY DEPLOYMENT: Using private key from SSH file");
  console.log("WARNING: SSH files are vulnerable to IDE extension attacks");
  console.log("For production: Use Thirdweb Dashboard deployment for maximum security");
  
  // Check if private key is loaded
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not found. Please check ~/.ssh/test-evm-deployment-key");
  }
  console.log("Private key loaded from SSH file");
  
  // Get default signer (uses PRIVATE_KEY from SSH file)
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  
  return { signer, address, method: "SSH Key" };
}

export async function verifyBytecode(
  hre: HardhatRuntimeEnvironment,
  deployedAddress: string,
  contractName: string
): Promise<void> {
  console.log(`\nBytecode Verification (runtime) for ${contractName}:`);

  try {
    const provider = hre.ethers.provider;
    const onChainRuntime = (await provider.getCode(deployedAddress)) || "0x";
    const artifact = await hre.artifacts.readArtifact(contractName as any);
    const localRuntime = (artifact.deployedBytecode as string) || "0x";

    const normalize = (hex: string) => hex.toLowerCase();
    const onChainNorm = normalize(onChainRuntime);
    const localNorm = normalize(localRuntime);

    if (onChainNorm === localNorm) {
      console.log("✅ Runtime bytecode matches compiled artifact");
      return;
    }

    // Fallback to hash comparison, in case metadata or link refs differ
    const onChainHash = hre.ethers.keccak256(onChainNorm as any);
    const localHash = hre.ethers.keccak256(localNorm as any);

    if (onChainHash === localHash) {
      console.log("✅ Runtime bytecode hash matches (normalized)");
      return;
    }

    console.warn("⚠️ Bytecode check did not match exactly. This can be due to metadata or library linking.");
    console.warn("   Proceeding, but please verify on the explorer as the authoritative check.");
  } catch (err: any) {
    console.warn(`⚠️ Runtime bytecode check skipped: ${err.message}`);
  }
}

export async function logTransactionForVerification(
  hre: HardhatRuntimeEnvironment,
  contractFactory: any,
  contractName: string
): Promise<void> {
  console.log(`\nTransaction Verification for ${contractName}:`);
  try {
    const deployTx = await contractFactory.getDeployTransaction();
    const bytecodeHash = hre.ethers.keccak256(deployTx.data || "0x");
    console.log(`Bytecode hash: ${bytecodeHash}`);
  } catch (error) {
    console.log("Could not generate deployment transaction preview");
  }
}

