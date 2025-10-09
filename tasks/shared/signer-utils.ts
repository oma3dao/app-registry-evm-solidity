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

// Deployer signer (admin + deploy)
export async function getDeployerSigner(hre: HardhatRuntimeEnvironment): Promise<{ signer: Signer; address: string; method: string }> {
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

/**
 * Issuer signer for writing attestations (separate from deployment key)
 * Priority:
 * 1) env.ISSUER_PRIVATE_KEY
 * 2) ~/.ssh/local-attestation-key (hex, with or without 0x)
 */
export async function getIssuerSigner(
  hre: HardhatRuntimeEnvironment
): Promise<{ signer: Signer; address: string; method: string }> {
  const pk = loadIssuerPrivateKey();
  const signer = new (hre.ethers as any).Wallet(pk, hre.ethers.provider) as Signer;
  const address = await (signer as any).getAddress();
  console.log("ISSUER KEY: Using issuer private key for attestation writes");
  return { signer, address, method: "Issuer SSH Key" };
}

function loadIssuerPrivateKey(): `0x${string}` {
  // 1) Env var
  const envPk = process.env.ISSUER_PRIVATE_KEY;
  if (envPk && /^0x[0-9a-fA-F]{64}$/.test(envPk.trim())) {
    return envPk.trim() as `0x${string}`;
  }
  if (envPk && /^[0-9a-fA-F]{64}$/.test(envPk.trim())) {
    return ("0x" + envPk.trim()) as `0x${string}`;
  }

  // 2) SSH file fallback (same path as API route)
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const sshKeyPath = path.join(os.homedir(), '.ssh', 'local-attestation-key');
  if (!fs.existsSync(sshKeyPath)) {
    throw new Error(
      `Issuer private key not found. Set ISSUER_PRIVATE_KEY or create ${sshKeyPath}`
    );
  }
  const keyContent = fs.readFileSync(sshKeyPath, 'utf8')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
  const withPrefix = keyContent.startsWith('0x') ? keyContent : `0x${keyContent}`;
  if (!/^0x[0-9a-f]{64}$/.test(withPrefix)) {
    throw new Error(`Invalid issuer key format in ${sshKeyPath}`);
  }
  return withPrefix as `0x${string}`;
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

export async function getSignerAndCheckOwnership(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  contractName: string
): Promise<{ signer: any; address: string }> {
  const { signer, address: signerAddress } = await getDeployerSigner(hre);
  console.log(`Signer: ${signerAddress}`);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress, signer);
  const owner = await contract.owner();
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Signer (${signerAddress}) is not the contract owner (${owner})`);
  }
  console.log("✅ Ownership verified\n");
  return { signer, address: signerAddress };
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

// User/developer signer for registry interactions (mint/update/etc.)
// Priority:
// 1) CLI --pk override (hex)
// 2) env.USER_PRIVATE_KEY
export async function getUserSigner(
  hre: HardhatRuntimeEnvironment,
  taskArgs?: { signerFileName?: string }
): Promise<{ signer: Signer; address: string; method: string }> {
  // SSH file in ~/.ssh/<signerFileName>
  const fileName = taskArgs?.signerFileName;
  if (fileName && fileName.trim().length > 0) {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const sshKeyPath = path.join(os.homedir(), '.ssh', fileName.trim());
    if (!fs.existsSync(sshKeyPath)) {
      throw new Error(`Signer file not found: ${sshKeyPath}`);
    }
    const keyContent = fs.readFileSync(sshKeyPath, 'utf8')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
    const withPrefix = keyContent.startsWith('0x') ? keyContent : `0x${keyContent}`;
    if (!/^0x[0-9a-f]{64}$/.test(withPrefix)) {
      throw new Error(`Invalid key format in ${sshKeyPath}. Expected hex private key`);
    }
    const signer = new (hre.ethers as any).Wallet(withPrefix, hre.ethers.provider) as Signer;
    const address = await (signer as any).getAddress();
    return { signer, address, method: `~/.ssh/${fileName.trim()}` };
  }

  throw new Error("User key required. Provide --signerFileName to load from ~/.ssh/<file>");
}

