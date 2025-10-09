import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { getIssuerSigner } from "../shared/signer-utils";
import { getNetworkContractAddress } from "../shared/env-helpers";

interface AttestDataUrlArgs {
  did: string;
  datahash: string;
  expires?: string;
}

task("resolver:attest-dataurl", "Attest dataUrl hash for a DID using SSH key signer")
  .addParam("did", "DID string (e.g., did:web:example.com)")
  .addParam("datahash", "Data hash (bytes32 0x...)")
  .addOptionalParam("expires", "Expiry timestamp (unix seconds), default 0", "0")
  .setAction(async (args: AttestDataUrlArgs, hre: HardhatRuntimeEnvironment) => {
    const { did, datahash, expires } = args;

    const { signer, address } = await getIssuerSigner(hre);

    const resolverAddress = getNetworkContractAddress(hre, "resolver");
    console.log(`\nResolver: ${resolverAddress}`);
    console.log(`Issuer (signer): ${address}`);
    console.log(`DID: ${did}`);
    console.log(`Data Hash: ${datahash}`);

    // Compute didHash off-chain
    const didHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(did));

    // Validate datahash param
    if (typeof datahash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(datahash)) {
      throw new Error("Invalid --datahash. Expected 0x + 64 hex chars");
    }
    const dataHash = datahash as `0x${string}`;

    console.log(`didHash: ${didHash}`);
    console.log(`dataHash: ${dataHash}`);
    console.log(`expiresAt: ${expires}`);

    const resolverContract = await hre.ethers.getContractAt("OMA3ResolverWithStore", resolverAddress, signer);

    // Write ownership attestation (optional – only if needed)
    // await (await resolverContract.upsertDirect(didHash, controller, 0)).wait();

    // Attest data hash
    const tx = await resolverContract.attestDataHash(didHash, dataHash, BigInt(expires || "0"));
    console.log(`Sent tx: ${tx.hash}`);
    const receipt = await tx.wait(1);
    if (receipt && typeof receipt.blockNumber === 'number') {
      console.log(`Confirmed in block ${receipt.blockNumber}`);
    } else {
      console.log(`Transaction confirmed`);
    }
  });

// Flat alias (no namespace) for convenience
task("resolver-attest-dataurl", "Alias of resolver:attest-dataurl")
  .addParam("did", "DID string (e.g., did:web:example.com)")
  .addParam("datahash", "Data hash (bytes32 0x...)")
  .addOptionalParam("expires", "Expiry timestamp (unix seconds), default 0", "0")
  .setAction(async (args: AttestDataUrlArgs, hre: HardhatRuntimeEnvironment) => {
    // Delegate to the namespaced task implementation
    return hre.run("resolver:attest-dataurl", args);
  });


