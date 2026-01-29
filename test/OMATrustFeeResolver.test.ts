/// <reference types="hardhat" />
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { ethers } from "hardhat";

describe("OMATrustFeeResolver", function () {
  // Test constants
  const FEE = ethers.parseEther("0.001"); // 0.001 ETH
  const TEST_SCHEMA = "string subject,uint8 rating";

  // Deploy EAS system + FeeResolver
  async function deployFeeResolverFixture() {
    const [deployer, treasury, attester, recipient] = await ethers.getSigners();

    // Deploy SchemaRegistry
    const SchemaRegistry = await ethers.getContractFactory(
      "contracts/eas/SchemaRegistry.sol:SchemaRegistry"
    );
    const schemaRegistry: any = await SchemaRegistry.deploy();
    await schemaRegistry.waitForDeployment();
    const schemaRegistryAddress = await schemaRegistry.getAddress();

    // Deploy EAS
    const EAS = await ethers.getContractFactory("contracts/eas/EAS.sol:EAS");
    const eas: any = await EAS.deploy(schemaRegistryAddress);
    await eas.waitForDeployment();
    const easAddress = await eas.getAddress();

    // Deploy FeeResolver
    const FeeResolver = await ethers.getContractFactory(
      "contracts/eas/resolver/custom/OMATrustFeeResolver.sol:OMATrustFeeResolver"
    );
    const feeResolver: any = await FeeResolver.deploy(easAddress, FEE, treasury.address);
    await feeResolver.waitForDeployment();

    return {
      schemaRegistry,
      eas,
      feeResolver,
      deployer,
      treasury,
      attester,
      recipient,
    };
  }

  // Deploy and register a schema with the resolver
  async function deployWithSchemaFixture() {
    const fixture = await loadFixture(deployFeeResolverFixture);
    const { schemaRegistry, feeResolver } = fixture;

    // Register schema with fee resolver
    const resolverAddress = await feeResolver.getAddress();
    const tx = await schemaRegistry.register(TEST_SCHEMA, resolverAddress, true);
    const receipt = await tx.wait();

    // Extract schema UID from event
    const event = receipt?.logs.find((log: any) => {
      try {
        return schemaRegistry.interface.parseLog(log)?.name === "Registered";
      } catch {
        return false;
      }
    });
    const parsedEvent = schemaRegistry.interface.parseLog(event!);
    const schemaUID = parsedEvent?.args.uid;

    return { ...fixture, schemaUID };
  }

  describe("Deployment", function () {
    it("Should deploy with correct fee and recipient", async function () {
      const { feeResolver, treasury } = await loadFixture(deployFeeResolverFixture);

      expect(await feeResolver.fee()).to.equal(FEE);
      expect(await feeResolver.feeRecipient()).to.equal(treasury.address);
    });

    it("Should return correct NAME and VERSION", async function () {
      const { feeResolver } = await loadFixture(deployFeeResolverFixture);

      expect(await feeResolver.NAME()).to.equal("OMATrust Fixed-Fee Resolver");
      expect(await feeResolver.VERSION()).to.equal("1.0");
    });

    it("Should be payable", async function () {
      const { feeResolver } = await loadFixture(deployFeeResolverFixture);

      expect(await feeResolver.isPayable()).to.be.true;
    });

    it("Should reject zero fee", async function () {
      const [, treasury] = await ethers.getSigners();
      const { eas } = await loadFixture(deployFeeResolverFixture);
      const easAddress = await eas.getAddress();

      const FeeResolver = await ethers.getContractFactory(
        "contracts/eas/resolver/custom/OMATrustFeeResolver.sol:OMATrustFeeResolver"
      );

      await expect(
        FeeResolver.deploy(easAddress, 0, treasury.address)
      ).to.be.revertedWith("Fee must be positive");
    });

    it("Should reject zero address recipient", async function () {
      const { eas } = await loadFixture(deployFeeResolverFixture);
      const easAddress = await eas.getAddress();

      const FeeResolver = await ethers.getContractFactory(
        "contracts/eas/resolver/custom/OMATrustFeeResolver.sol:OMATrustFeeResolver"
      );

      await expect(
        FeeResolver.deploy(easAddress, FEE, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
    });
  });

  describe("Fee Collection", function () {
    it("Should accept attestation with exact fee", async function () {
      const { eas, schemaUID, attester, recipient } = await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      const tx = await eas.connect(attester).attest(
        {
          schema: schemaUID,
          data: {
            recipient: recipient.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: FEE, // Value passed to resolver
          },
        },
        { value: FEE } // ETH sent with transaction
      );

      await expect(tx).to.not.be.reverted;
    });

    it("Should reject attestation with insufficient fee", async function () {
      const { eas, schemaUID, attester, recipient } = await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      const insufficientFee = FEE - 1n;

      await expect(
        eas.connect(attester).attest(
          {
            schema: schemaUID,
            data: {
              recipient: recipient.address,
              expirationTime: 0,
              revocable: true,
              refUID: ethers.ZeroHash,
              data: attestationData,
              value: insufficientFee,
            },
          },
          { value: insufficientFee }
        )
      ).to.be.revertedWithCustomError;
    });

    it("Should reject attestation with excess fee (exact fee required)", async function () {
      const { eas, schemaUID, attester, recipient } = await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      const excessFee = FEE + 1n;

      await expect(
        eas.connect(attester).attest(
          {
            schema: schemaUID,
            data: {
              recipient: recipient.address,
              expirationTime: 0,
              revocable: true,
              refUID: ethers.ZeroHash,
              data: attestationData,
              value: excessFee,
            },
          },
          { value: excessFee }
        )
      ).to.be.revertedWithCustomError;
    });

    it("Should forward fee to treasury immediately", async function () {
      const { eas, schemaUID, attester, recipient, treasury } =
        await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      await eas.connect(attester).attest(
        {
          schema: schemaUID,
          data: {
            recipient: recipient.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: FEE,
          },
        },
        { value: FEE }
      );

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(FEE);
    });

    it("Should not hold any balance after attestation", async function () {
      const { eas, feeResolver, schemaUID, attester, recipient } =
        await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      await eas.connect(attester).attest(
        {
          schema: schemaUID,
          data: {
            recipient: recipient.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: FEE,
          },
        },
        { value: FEE }
      );

      const resolverBalance = await ethers.provider.getBalance(
        await feeResolver.getAddress()
      );

      expect(resolverBalance).to.equal(0);
    });
  });

  describe("Revocations", function () {
    it("Should allow free revocations", async function () {
      const { eas, schemaUID, attester, recipient } = await loadFixture(deployWithSchemaFixture);

      const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "uint8"],
        ["did:web:example.com", 5]
      );

      // Create attestation first
      const tx = await eas.connect(attester).attest(
        {
          schema: schemaUID,
          data: {
            recipient: recipient.address,
            expirationTime: 0,
            revocable: true,
            refUID: ethers.ZeroHash,
            data: attestationData,
            value: FEE,
          },
        },
        { value: FEE }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return eas.interface.parseLog(log)?.name === "Attested";
        } catch {
          return false;
        }
      });
      const parsedEvent = eas.interface.parseLog(event!);
      const attestationUID = parsedEvent?.args.uid;

      // Revoke without fee
      const revokeTx = await eas.connect(attester).revoke({
        schema: schemaUID,
        data: {
          uid: attestationUID,
          value: 0,
        },
      });

      await expect(revokeTx).to.not.be.reverted;
    });
  });

  describe("Multiple Attestations", function () {
    it("Should collect fees from multiple attestations", async function () {
      const { eas, schemaUID, attester, recipient, treasury } =
        await loadFixture(deployWithSchemaFixture);

      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);

      // Create 3 attestations
      for (let i = 0; i < 3; i++) {
        const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "uint8"],
          [`did:web:example${i}.com`, i + 1]
        );

        await eas.connect(attester).attest(
          {
            schema: schemaUID,
            data: {
              recipient: recipient.address,
              expirationTime: 0,
              revocable: true,
              refUID: ethers.ZeroHash,
              data: attestationData,
              value: FEE,
            },
          },
          { value: FEE }
        );
      }

      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(FEE * 3n);
    });
  });
});
