import { ethers } from "hardhat";
import type { Signer } from "ethers";

/**
 * Secure signer utility - protects against IDE extension attacks
 * Reference: https://x.com/0xzak/status/1955655184522371361 ($500k+ stolen from crypto devs)
 */

export async function getSecureSigner(useSSHKey: boolean = false): Promise<{ signer: Signer; address: string; method: string }> {
  if (useSSHKey) {
    return await getSSHKeySigner();
  } else {
    return await getLedgerSigner();
  }
}

async function getLedgerSigner(): Promise<{ signer: Signer; address: string; method: string }> {
  console.log("SECURE DEPLOYMENT: Using hardware wallet");
  
  // Import LedgerSigner
  let LedgerSigner;
  try {
    const hardwareWallets = await import("@ethersproject/hardware-wallets");
    LedgerSigner = hardwareWallets.LedgerSigner;
  } catch (error) {
    console.error("❌ @ethersproject/hardware-wallets not installed!");
    console.error("Install with: npm install @ethersproject/hardware-wallets@5.8.0");
    console.error("Alternative: Use --ssh-key flag for SSH file deployment");
    throw new Error("Hardware wallet package required for secure deployment");
  }

  // Ledger setup instructions
  console.log("\nLedger Setup Required:");
  console.log("   - Connect Ledger via USB");
  console.log("   - Unlock with PIN");
  console.log("   - Open Ethereum app");
  console.log("   - Enable 'Contract Data' in Ethereum app settings");
  
  try {
    // Create Ledger signer with proper type handling for ethers v6
    const provider = ethers.provider as any; // Cast to handle ethers v6 compatibility
    const ledgerSigner = new LedgerSigner(provider, "hid", "m/44'/60'/0'/0/0");
    const signer = ledgerSigner as any as Signer; // Type cast for ethers v6 compatibility
    
    // Verify connection
    const address = await signer.getAddress();
    console.log(`✅ Ledger connected. Address: ${address}`);

    return { signer, address, method: "Hardware Wallet" };
    
  } catch (error: any) {
    if (error.message.includes("denied")) {
      console.error("Transaction denied on Ledger device");
    } else if (error.message.includes("connection")) {
      console.error("Check Ledger connection and Ethereum app");
    }
    throw error;
  }
}

async function getSSHKeySigner(): Promise<{ signer: Signer; address: string; method: string }> {
  console.log("SSH KEY DEPLOYMENT: Less secure method");
  console.log("WARNING: SSH files are vulnerable to IDE extension attacks");
  console.log("Recommendation: Use hardware wallet (remove --ssh-key flag)");
  
  // Check if private key is loaded
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not found. Please check ~/.ssh/test-evm-deployment-key");
  }
  console.log("Private key loaded from SSH file");
  
  // Get default signer (uses PRIVATE_KEY from SSH file)
  const [signer] = await ethers.getSigners();
  const address = await signer.getAddress();
  
  return { signer, address, method: "SSH Key" };
}

export async function verifyBytecode(
  deployedAddress: string,
  expectedBytecode: string,
  contractName: string
): Promise<void> {
  console.log(`\nBytecode Verification for ${contractName}:`);
  
  const provider = ethers.provider;
  const deployedCode = await provider.getCode(deployedAddress);
  
  if (deployedCode === expectedBytecode) {
    console.log("✅ Bytecode verification PASSED");
  } else {
    console.error("❌ BYTECODE MISMATCH - POTENTIAL COMPROMISE!");
    console.error(`Contract: ${contractName}`);
    console.error(`Address: ${deployedAddress}`);
    throw new Error(`Bytecode verification failed for ${contractName}`);
  }
}

export async function logTransactionForVerification(
  contractFactory: any,
  contractName: string
): Promise<void> {
  console.log(`\nTransaction Verification for ${contractName}:`);
  try {
    const deployTx = await contractFactory.getDeployTransaction();
    const bytecodeHash = ethers.keccak256(deployTx.data || "0x");
    console.log(`Bytecode hash: ${bytecodeHash}`);
  } catch (error) {
    console.log("Could not generate deployment transaction preview");
  }
}
