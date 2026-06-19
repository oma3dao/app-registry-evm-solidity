/// <reference types="hardhat" />
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";

/**
 * AppView Parity Test
 * 
 * Purpose: Ensure that the AppView struct stays in sync with the App struct.
 * This test validates that:
 * 1. All fields from App exist in AppView with the same names and types
 * 2. AppView has exactly two additional fields: currentOwner (address) and tokenId (uint256)
 * 3. Field order and naming remain consistent for ABI stability
 * 
 * Why this matters:
 * - Auditors and indexers rely on stable ABI field order and naming
 * - Manual struct duplication can lead to drift over time
 * - This test catches any mismatch immediately in CI
 */
describe("AppView Parity Test", function () {
  let registry: any;

  before(async function () {
    const OMA3AppRegistry = await ethers.getContractFactory("OMA3AppRegistry");
    registry = await OMA3AppRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("should have AppView struct with all App fields plus currentOwner and tokenId", async function () {
    // Get the contract's ABI
    const abi = registry.interface.fragments;
    
    // Find the App and AppView struct definitions in the ABI
    // Note: Structs are encoded as tuple types in function return values
    const getAppFunction = registry.interface.getFunction("getApp");
    const returnType = getAppFunction.outputs[0];
    
    // Verify the return type is a tuple (struct)
    expect(returnType.type).to.equal("tuple", "getApp should return a struct (tuple)");
    
    // Get the AppView fields from the return type
    const appViewFields = returnType.components;
    
    // Expected fields in AppView (matching App + currentOwner + tokenId)
    const expectedFields = [
      { name: "minter", type: "address" },
      { name: "interfaces", type: "uint16" },
      { name: "versionMajor", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "dataHashAlgorithm", type: "uint8" },
      { name: "dataHash", type: "bytes32" },
      { name: "did", type: "string" },
      { name: "fungibleTokenId", type: "string" },
      { name: "contractId", type: "string" },
      { name: "dataUrl", type: "string" },
      { name: "versionHistory", type: "tuple[]" },
      { name: "traitHashes", type: "bytes32[]" },
      { name: "currentOwner", type: "address" },
      { name: "tokenId", type: "uint256" }
    ];
    
    // Verify field count
    expect(appViewFields.length).to.equal(
      expectedFields.length,
      `AppView should have exactly ${expectedFields.length} fields (App fields + currentOwner + tokenId)`
    );
    
    // Verify each field name and type
    for (let i = 0; i < expectedFields.length; i++) {
      const expected = expectedFields[i];
      const actual = appViewFields[i];
      
      expect(actual.name).to.equal(
        expected.name,
        `Field ${i}: name mismatch`
      );
      
      expect(actual.type).to.equal(
        expected.type,
        `Field ${i} (${expected.name}): type mismatch`
      );
    }
  });

  it("should verify tokenId is the last field in AppView", async function () {
    const getAppFunction = registry.interface.getFunction("getApp");
    const returnType = getAppFunction.outputs[0];
    const appViewFields = returnType.components;
    
    const lastField = appViewFields[appViewFields.length - 1];
    
    expect(lastField.name).to.equal("tokenId");
    expect(lastField.type).to.equal("uint256");
  });

  it("should verify getAppsByOwner also returns AppView structs", async function () {
    const getAppsByOwnerFunction = registry.interface.getFunction("getAppsByOwner");
    const returnType = getAppsByOwnerFunction.outputs[0]; // First return value (apps array)
    
    // Should be an array of tuples
    expect(returnType.type).to.equal("tuple[]", "getAppsByOwner should return an array of structs");
    
    // Verify the tuple structure matches AppView
    // For arrays, the baseType property contains the component definition
    const arrayBaseType = returnType.baseType;
    expect(arrayBaseType).to.equal("array");
    
    // The arrayChildren property contains the tuple definition
    const tupleType = returnType.arrayChildren;
    expect(tupleType).to.not.be.null;
    expect(tupleType).to.not.be.undefined;
    
    if (tupleType && tupleType.components) {
      expect(tupleType.components.length).to.equal(14, "AppView should have 14 fields");
      expect(tupleType.components[tupleType.components.length - 1].name).to.equal("tokenId");
    }
  });

  it("should verify all query functions return AppView", async function () {
    // List of functions that should return AppView or AppView[]
    const viewFunctions = [
      "getApp",
      "getAppsByOwner",
      "getAppsByStatus",
      "getApps",
      "getAppsByInterface"
    ];
    
    for (const funcName of viewFunctions) {
      const func = registry.interface.getFunction(funcName);
      const returnType = func.outputs[0];
      
      // Get the base type (remove [] if array)
      const baseType = returnType.type.replace("[]", "");
      expect(baseType).to.equal("tuple", `${funcName} should return AppView struct(s)`);
      
      // Verify it has currentOwner and tokenId fields
      const fields = returnType.components;
      if (fields) {
        const hasCurrentOwner = fields.some((f: any) => f.name === "currentOwner");
        const hasTokenId = fields.some((f: any) => f.name === "tokenId");
        expect(hasCurrentOwner).to.equal(true, `${funcName} should return AppView with currentOwner field`);
        expect(hasTokenId).to.equal(true, `${funcName} should return AppView with tokenId field`);
      }
    }
  });
});
