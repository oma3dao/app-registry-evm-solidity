import { task } from "hardhat/config";
import { NETWORK_CONTRACTS } from "../../hardhat.config";

/**
 * Fee resolver sanity test for deployed contracts
 * Tests: Schema registration with resolver → Attestation with fee → Fee received by treasury
 */
task("fee-resolver-sanity", "Run fee resolver sanity test on deployed contract")
  .addParam("resolver", "Deployed OMATrustFeeResolver address")
  .addOptionalParam("treasury", "Expected treasury address (optional, reads from contract if not provided)")
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name as keyof typeof NETWORK_CONTRACTS;
    const schemaRegistryAddress = NETWORK_CONTRACTS[networkName]?.easSchemaRegistry;
    const easAddress = NETWORK_CONTRACTS[networkName]?.easContract;

    console.log("\n========================================");
    console.log("Fee Resolver Sanity Test");
    console.log(`Network: ${networkName}`);
    console.log("========================================\n");

    if (!schemaRegistryAddress || schemaRegistryAddress === "0x") {
      throw new Error(`SchemaRegistry not configured for network ${networkName}`);
    }

    if (!easAddress || easAddress === "0x") {
      throw new Error(`EAS contract not configured for network ${networkName}`);
    }

    const resolverAddress = taskArgs.resolver;
    if (!hre.ethers.isAddress(resolverAddress)) {
      throw new Error(`Invalid resolver address: ${resolverAddress}`);
    }

    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();

    console.log(`Signer: ${signerAddress}`);
    console.log(`SchemaRegistry: ${schemaRegistryAddress}`);
    console.log(`EAS: ${easAddress}`);
    console.log(`FeeResolver: ${resolverAddress}\n`);

    // Step 1: Read resolver configuration
    console.log("Step 1: Reading resolver configuration...");
    const feeResolver = await hre.ethers.getContractAt(
      "contracts/reputation/OMATrustFeeResolver.sol:OMATrustFeeResolver",
      resolverAddress,
      signer
    );

    const fee = await feeResolver.fee();
    const feeRecipient = await feeResolver.feeRecipient();
    const resolverName = await feeResolver.NAME();
    const resolverVersion = await feeResolver.VERSION();
    const isPayable = await feeResolver.isPayable();

    console.log(`   NAME: ${resolverName}`);
    console.log(`   VERSION: ${resolverVersion}`);
    console.log(`   Fee: ${hre.ethers.formatEther(fee)} ETH`);
    console.log(`   Fee Recipient: ${feeRecipient}`);
    console.log(`   Is Payable: ${isPayable}`);

    if (!isPayable) {
      throw new Error("Resolver is not payable - this is unexpected");
    }

    // Verify treasury if provided
    if (taskArgs.treasury) {
      if (feeRecipient.toLowerCase() !== taskArgs.treasury.toLowerCase()) {
        throw new Error(`Treasury mismatch! Expected ${taskArgs.treasury}, got ${feeRecipient}`);
      }
      console.log(`   ✅ Treasury address matches expected`);
    }
    console.log(`✅ Resolver configuration verified\n`);

    // Step 2: Check signer balance
    console.log("Step 2: Checking signer balance...");
    const signerBalance = await hre.ethers.provider.getBalance(signerAddress);
    const requiredBalance = fee + hre.ethers.parseEther("0.01"); // Fee + gas buffer

    console.log(`   Signer balance: ${hre.ethers.formatEther(signerBalance)} ETH`);
    console.log(`   Required (fee + gas): ~${hre.ethers.formatEther(requiredBalance)} ETH`);

    if (signerBalance < requiredBalance) {
      throw new Error(`Insufficient balance. Need at least ${hre.ethers.formatEther(requiredBalance)} ETH`);
    }
    console.log(`✅ Sufficient balance\n`);

    // Step 3: Register a test schema with the resolver
    console.log("Step 3: Registering test schema with fee resolver...");
    const schemaRegistry = await hre.ethers.getContractAt(
      "deps/eas/SchemaRegistry.sol:SchemaRegistry",
      schemaRegistryAddress,
      signer
    );

    const testSchema = "string sanityTestSubject,uint64 sanityTestTimestamp";
    const tx1 = await schemaRegistry.register(testSchema, resolverAddress, true);
    const receipt1 = await tx1.wait();

    const event1 = receipt1?.logs.find((log: any) => {
      try {
        return schemaRegistry.interface.parseLog(log)?.name === "Registered";
      } catch {
        return false;
      }
    });

    if (!event1) {
      throw new Error("Failed to find Registered event");
    }

    const parsedEvent1 = schemaRegistry.interface.parseLog(event1);
    const schemaUID = parsedEvent1?.args.uid;
    console.log(`   Schema UID: ${schemaUID}`);
    console.log(`✅ Schema registered with fee resolver\n`);

    // Step 4: Get treasury balance before attestation
    console.log("Step 4: Recording treasury balance before attestation...");
    const treasuryBalanceBefore = await hre.ethers.provider.getBalance(feeRecipient);
    console.log(`   Treasury balance: ${hre.ethers.formatEther(treasuryBalanceBefore)} ETH\n`);

    // Step 5: Create attestation with fee
    console.log("Step 5: Creating attestation with fee...");
    const eas = await hre.ethers.getContractAt(
      "deps/eas/EAS.sol:EAS",
      easAddress,
      signer
    );

    const attestationData = hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint64"],
      ["sanity-test-subject", BigInt(Math.floor(Date.now() / 1000))]
    );

    console.log(`   Sending attestation with ${hre.ethers.formatEther(fee)} ETH fee...`);

    const tx2 = await eas.attest(
      {
        schema: schemaUID,
        data: {
          recipient: signerAddress,
          expirationTime: 0,
          revocable: true,
          refUID: hre.ethers.ZeroHash,
          data: attestationData,
          value: 0,
        },
      },
      { value: fee }
    );

    const receipt2 = await tx2.wait();

    const event2 = receipt2?.logs.find((log: any) => {
      try {
        return eas.interface.parseLog(log)?.name === "Attested";
      } catch {
        return false;
      }
    });

    if (!event2) {
      throw new Error("Failed to find Attested event - attestation may have failed");
    }

    const parsedEvent2 = eas.interface.parseLog(event2);
    const attestationUID = parsedEvent2?.args.uid;
    console.log(`   Attestation UID: ${attestationUID}`);
    console.log(`✅ Attestation created successfully\n`);

    // Step 6: Verify fee was received by treasury
    console.log("Step 6: Verifying fee was received by treasury...");
    const treasuryBalanceAfter = await hre.ethers.provider.getBalance(feeRecipient);
    const feeReceived = treasuryBalanceAfter - treasuryBalanceBefore;

    console.log(`   Treasury balance before: ${hre.ethers.formatEther(treasuryBalanceBefore)} ETH`);
    console.log(`   Treasury balance after:  ${hre.ethers.formatEther(treasuryBalanceAfter)} ETH`);
    console.log(`   Fee received: ${hre.ethers.formatEther(feeReceived)} ETH`);

    if (feeReceived !== fee) {
      throw new Error(`Fee mismatch! Expected ${hre.ethers.formatEther(fee)}, received ${hre.ethers.formatEther(feeReceived)}`);
    }
    console.log(`✅ Fee correctly forwarded to treasury\n`);

    // Step 7: Verify resolver has no balance
    console.log("Step 7: Verifying resolver has no balance (no custody)...");
    const resolverBalance = await hre.ethers.provider.getBalance(resolverAddress);
    console.log(`   Resolver balance: ${hre.ethers.formatEther(resolverBalance)} ETH`);

    if (resolverBalance !== 0n) {
      console.warn(`⚠️  Warning: Resolver has non-zero balance: ${hre.ethers.formatEther(resolverBalance)} ETH`);
    } else {
      console.log(`✅ Resolver has zero balance (no custody)\n`);
    }

    // Summary
    console.log("========================================");
    console.log("✅ ALL TESTS PASSED!");
    console.log("========================================");
    console.log(`Resolver:        ${resolverAddress}`);
    console.log(`Fee:             ${hre.ethers.formatEther(fee)} ETH`);
    console.log(`Treasury:        ${feeRecipient}`);
    console.log(`Test Schema UID: ${schemaUID}`);
    console.log(`Attestation UID: ${attestationUID}`);
    console.log("========================================\n");

    console.log(`✅ Fee resolver on ${networkName} is working correctly!`);
    console.log(`\n⚠️  Note: A test schema was registered. This is expected for sanity testing.`);
  });
