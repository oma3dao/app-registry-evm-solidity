import { expect } from "chai";
import { ethers } from "hardhat";
import { OMA3AppRegistryLegacy } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("OMA3AppRegistryLegacy Pagination Boundary Coverage", function () {
  let registryLegacy: OMA3AppRegistryLegacy;
  let user1: SignerWithAddress;

  beforeEach(async function () {
    [, user1] = await ethers.getSigners();

    const RegistryLegacyFactory = await ethers.getContractFactory("OMA3AppRegistryLegacy");
    registryLegacy = await RegistryLegacyFactory.deploy();
  });

  it("Should cover line 240 - pagination when returnIndex equals MAX_DIDS_PER_PAGE", async function () {
    // This test specifically targets line 240 in getAppDIDsByStatus
    // where returnIndex == MAX_DIDS_PER_PAGE and we use tempDIDs directly
    
    const MAX_DIDS_PER_PAGE = 50; // This should match the constant in the contract
    
    // Mint exactly MAX_DIDS_PER_PAGE apps
    console.log(`Minting ${MAX_DIDS_PER_PAGE} apps to test pagination boundary...`);
    
    for (let i = 0; i < MAX_DIDS_PER_PAGE; i++) {
      await registryLegacy.mint(
        `did:oma3:test${i.toString().padStart(3, '0')}`,
          ethers.encodeBytes32String(`Test App ${i}`),
          ethers.encodeBytes32String("1.0.0"),
        "https://example.com/data",
        "https://example.com/iwps", 
        "https://example.com/api",
        "0x1234567890123456789012345678901234567890123456789012345678901234"
      );
    }

    console.log("All apps minted, testing pagination...");

    // Query with status 0 (ACTIVE) starting from index 0
    // This should return exactly MAX_DIDS_PER_PAGE results, triggering line 240
    const [dids, nextTokenId] = await registryLegacy.getAppDIDsByStatus(1, 0);
    
    console.log(`Returned ${dids.length} DIDs, nextTokenId: ${nextTokenId}`);
    
    // Verify we got exactly MAX_DIDS_PER_PAGE results
    expect(dids.length).to.equal(MAX_DIDS_PER_PAGE);
    // nextTokenId should be 0 since we've reached the end (50 apps total)
    expect(nextTokenId).to.equal(0);
    
    // Verify all DIDs are present and in correct order
    for (let i = 0; i < MAX_DIDS_PER_PAGE; i++) {
      const expectedDID = `did:oma3:test${i.toString().padStart(3, '0')}`;
      expect(dids[i]).to.equal(expectedDID);
    }
  });

  it("Should cover line 240 with different status values", async function () {
    const MAX_DIDS_PER_PAGE = 50;
    
    // Mint apps with different statuses
    for (let i = 0; i < MAX_DIDS_PER_PAGE; i++) {
      await registryLegacy.mint(
        `did:oma3:active${i.toString().padStart(3, '0')}`,
          ethers.encodeBytes32String(`Active App ${i}`),
          ethers.encodeBytes32String("1.0.0"),
        "https://example.com/data",
        "https://example.com/iwps",
        "https://example.com/api", 
        "0x1234567890123456789012345678901234567890123456789012345678901234"
      );
    }

    // Update some to different statuses
    for (let i = 0; i < 25; i++) {
      await registryLegacy.updateStatus(`did:oma3:active${i.toString().padStart(3, '0')}`, 1); // DEPRECATED
    }

    // Now query for ACTIVE status - should return exactly 25 results
    const [activeDids, activeNextTokenId] = await registryLegacy.getAppDIDsByStatus(1, 0);
    expect(activeDids.length).to.equal(25);
    expect(activeNextTokenId).to.equal(0); // No more active apps after the first 25

    // Query for DEPRECATED status - should return exactly 25 results  
    const [deprecatedDids, deprecatedNextTokenId] = await registryLegacy.getAppDIDsByStatus(1, 1);
    expect(deprecatedDids.length).to.equal(25);
    expect(deprecatedNextTokenId).to.equal(0); // No more deprecated apps
  });

  it("Should handle edge case with exactly MAX_DIDS_PER_PAGE - 1 results", async function () {
    const MAX_DIDS_PER_PAGE = 50;
    
    // Mint MAX_DIDS_PER_PAGE - 1 apps
    for (let i = 0; i < MAX_DIDS_PER_PAGE - 1; i++) {
      await registryLegacy.mint(
        `did:oma3:test${i.toString().padStart(3, '0')}`,
          ethers.encodeBytes32String(`Test App ${i}`),
          ethers.encodeBytes32String("1.0.0"),
        "https://example.com/data",
        "https://example.com/iwps",
        "https://example.com/api",
        "0x1234567890123456789012345678901234567890123456789012345678901234"
      );
    }

    // This should trigger the else branch (line 242) where we create a new array
    const [dids, nextTokenId] = await registryLegacy.getAppDIDsByStatus(1, 0);
    
    expect(dids.length).to.equal(MAX_DIDS_PER_PAGE - 1);
    expect(nextTokenId).to.equal(0); // No more apps
  });
});
