import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";

task("generate-deployment-key", "Generate a new secp256k1 deployment key (private key, public key, and address)")
  .addParam("filename", "Base name for key files (stored in ~/.ssh/)")
  .addFlag("force", "Overwrite existing key files if they exist")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    const filename = taskArgs.filename as string;
    const force = taskArgs.force as boolean;

    const sshDir = path.join(process.env.HOME || "", ".ssh");
    const privateKeyPath = path.join(sshDir, filename);
    const publicKeyPath = path.join(sshDir, `${filename}.pub`);
    const addressPath = path.join(sshDir, `${filename}.address`);

    // Safety check: refuse to overwrite unless --force is passed
    const existingFiles = [privateKeyPath, publicKeyPath, addressPath].filter(f => fs.existsSync(f));
    if (existingFiles.length > 0 && !force) {
      console.error("\n❌ Key files already exist:");
      existingFiles.forEach(f => console.error(`   ${f}`));
      console.error("\nUse --force to overwrite existing files.");
      process.exit(1);
    }

    // Ensure ~/.ssh directory exists with correct permissions
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700 });
      console.log(`Created directory: ${sshDir}`);
    }

    // Generate a random wallet (secp256k1 keypair)
    const wallet = ethers.Wallet.createRandom();

    // Extract key material
    const privateKey = wallet.privateKey.replace(/^0x/, ""); // raw 64-char hex
    const publicKey = wallet.signingKey.publicKey;            // 0x-prefixed uncompressed
    const address = wallet.address;                          // 0x-prefixed checksummed

    // Write private key (raw hex, no 0x prefix — matches loadPrivateKeyFromSshFile expectations)
    fs.writeFileSync(privateKeyPath, privateKey + "\n", { mode: 0o600 });
    console.log(`✅ Private key: ${privateKeyPath}`);

    // Write public key (uncompressed, 0x-prefixed)
    fs.writeFileSync(publicKeyPath, publicKey + "\n", { mode: 0o644 });
    console.log(`✅ Public key:  ${publicKeyPath}`);

    // Write Ethereum address (checksummed)
    fs.writeFileSync(addressPath, address + "\n", { mode: 0o644 });
    console.log(`✅ Address:     ${addressPath}`);

    console.log("\n📝 Summary:");
    console.log(`   Ethereum address: ${address}`);
    console.log(`   Files created in: ${sshDir}/`);
    console.log(`     ${filename}          (private key - 600 permissions)`);
    console.log(`     ${filename}.pub      (public key)`);
    console.log(`     ${filename}.address  (Ethereum address)`);

    console.log("\n⚠️  Next steps:");
    console.log(`1. Fund ${address} with native tokens on the target chain`);
    console.log(`2. Run deployment tasks with --network <target>`);
    console.log(`   The key will be auto-selected based on network, or override with:`);
    console.log(`   export DEPLOYMENT_KEY_PATH=~/.ssh/${filename}`);
    console.log("\n🔒 Security:");
    console.log("   - The private key file has 600 permissions (owner read/write only)");
    console.log("   - After deployment + ownership transfer, the key is powerless and can be deleted");
    console.log("   - Never commit key files to version control");
  });
