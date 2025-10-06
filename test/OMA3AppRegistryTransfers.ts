/// <reference types="hardhat" />
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
const hre = require("hardhat");

// Keep these in sync with the constants in the contract
const MAX_DID_LENGTH = 128;
const MAX_URL_LENGTH = 256;
const MAX_TRAITS = 20;

// Interface types according to specification (0=human, 2=api, 4=smart contract)
const INTERFACE_TYPES = {
  HUMAN: 0,
  API: 2,
  SMART_CONTRACT: 4
};

// Status values
const STATUS = {
  ACTIVE: 0,
  DEPRECATED: 1,
  REPLACED: 2
};

// Data hash algorithms according to specification
const DATA_HASH_ALGORITHMS = {
  KECCAK256: "keccak256",
  SHA256: "sha256"
};

// Backwards-compat proxy: adapt old mint signature used in tests to current contract ABI.
function makeCompatProxy(contract: any) {
	const toBitmap = (interfacesArg: any): number => {
		if (Array.isArray(interfacesArg)) {
			if (interfacesArg.length === 1 && typeof interfacesArg[0] === "number" && interfacesArg[0] > 7) {
				// Tests may pass a precomputed bitmap wrapped in an array (e.g., [8], [15], [255])
				return interfacesArg[0];
			}
			return interfacesArg.reduce((acc: number, i: number) => acc | (1 << Number(i)), 0);
		}
		return Number(interfacesArg) || 0;
	};

	const toAlgo = (algo: any): number => {
		if (typeof algo === "string") {
			return algo === DATA_HASH_ALGORITHMS.KECCAK256 ? 0 : 1;
		}
		return Number(algo) || 0;
	};

	const fromBitmap = (bitmap: any): number[] => {
		const n = typeof bitmap === "bigint" ? Number(bitmap) : Number(bitmap);
		const out: number[] = [];
		for (let i = 0; i < 16; i++) {
			if ((n & (1 << i)) !== 0) out.push(i);
		}
		return out;
	};

	const fromAlgo = (algoNum: any): string => {
		const n = typeof algoNum === "bigint" ? Number(algoNum) : Number(algoNum);
		return n === 0 ? DATA_HASH_ALGORITHMS.KECCAK256 : DATA_HASH_ALGORITHMS.SHA256;
	};

	const mapAppStruct = (app: any) => {
		// Ethers v6 returns a Result (array-like) with non-enumerable named props.
		// Index mapping per App struct layout in contract.
		const minter = app[0];
		const interfacesBitmap = app[1];
		const versionMajor = app[2];
		const status = app[3];
		const algoNum = app[4];
		const dataHash = app[5];
		const did = app[6];
		const fungibleTokenId = app[7];
		const contractId = app[8];
		const dataUrl = app[9];
		const versionHistory = app[10];
		const traitHashes = app[11];
		return {
			minter,
			interfaces: fromBitmap(interfacesBitmap),
			versionMajor,
			status,
			dataHashAlgorithm: fromAlgo(algoNum),
			dataHash,
			did,
			fungibleTokenId,
			contractId,
			dataUrl,
			versionHistory,
			traitHashes
		};
	};

	return new Proxy(contract, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (prop === "connect") {
				return (signer: any) => makeCompatProxy(value.call(target, signer));
			}
			if (prop === "mint") {
				return (...args: any[]) => {
					// Old tests: mint(did, status, dataUrl, dataHash, algoStr, fungibleTokenId, contractId, maj, min, patch, traitHashes, interfacesArr, metadataJson)
					if (args.length === 13) {
						const [did, _statusIgnored, dataUrl, dataHash, algo, fungibleTokenId, contractId, maj, min, patch, traitHashes, interfacesArr, metadataJson] = args;
						return target.mint(
							did,
							toBitmap(interfacesArr),
							dataUrl,
							dataHash,
							toAlgo(algo),
							fungibleTokenId,
							contractId,
							maj,
							min,
							patch,
							traitHashes,
							metadataJson
						);
					}
					// New tests: mint(did, interfacesArg, dataUrl, dataHash, algo, fungibleTokenId, contractId, maj, min, patch, traitHashes, metadataJson)
					if (args.length === 12) {
						const [did, interfacesArg, dataUrl, dataHash, algo, fungibleTokenId, contractId, maj, min, patch, traitHashes, metadataJson] = args;
						return target.mint(
							did,
							toBitmap(interfacesArg),
							dataUrl,
							dataHash,
							toAlgo(algo),
							fungibleTokenId,
							contractId,
							maj,
							min,
							patch,
							traitHashes,
							metadataJson
						);
					}
					return value.apply(target, args);
				};
			}
			if (prop === "getAppsByStatus" || prop === "getApps" || prop === "getAppsByOwner") {
				return async (...args: any[]) => {
					const result = await value.apply(target, args);
					// result is a tuple: [apps, nextStartIndex]
					return result;
				};
			}
			return value;
		}
	});
}

async function deployFixture() {
  const [owner, alice, bob, charlie, minter1, minter2, minter3, ...signers] = await hre.ethers.getSigners();

  const OMA3AppRegistry = await hre.ethers.getContractFactory("OMA3AppRegistry");
  const registry = await OMA3AppRegistry.deploy();
  await registry.waitForDeployment();

  const registryProxy = makeCompatProxy(registry);

  return { registry: registryProxy, owner, alice, bob, charlie, minter1, minter2, minter3, signers };
}

describe("NFT Transfer Ownership Tracking", function () {
  it("should update getAppsByOwner after transferFrom", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    // Setup: alice mints an app
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Verify alice owns it
    expect(await registry.ownerOf(tokenId)).to.equal(alice.address);
    const [aliceAppsBefore] = await registry.getAppsByOwner(alice.address, 0);
    expect(aliceAppsBefore.length).to.equal(1);
    
    // Transfer to bob
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    // Verify bob owns it
    expect(await registry.ownerOf(tokenId)).to.equal(bob.address);
    
    // Verify getAppsByOwner updated
    const [aliceAppsAfter] = await registry.getAppsByOwner(alice.address, 0);
    expect(aliceAppsAfter.length).to.equal(0);
    
    const [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps.length).to.equal(1);
    expect(bobApps[0].did).to.equal("did:test:example");
    
    // Verify original minter unchanged
    expect(bobApps[0].minter).to.equal(alice.address);
  });
  
  it("should update getTotalAppsByOwner after transferFrom", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    // Similar test but checking getTotalAppsByOwner()
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(1);
    expect(await registry.getTotalAppsByOwner(bob.address)).to.equal(0);
    
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(0);
    expect(await registry.getTotalAppsByOwner(bob.address)).to.equal(1);
  });
  
  it("should maintain consistency between balanceOf and getTotalAppsByOwner", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Before transfer
    expect(await registry.balanceOf(alice.address)).to.equal(
      await registry.getTotalAppsByOwner(alice.address)
    );
    
    // After transfer
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    expect(await registry.balanceOf(alice.address)).to.equal(
      await registry.getTotalAppsByOwner(alice.address)
    );
    expect(await registry.balanceOf(bob.address)).to.equal(
      await registry.getTotalAppsByOwner(bob.address)
    );
  });
});

describe("SafeTransferFrom Ownership Tracking", function () {
  it("should update ownership after safeTransferFrom", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // safeTransferFrom without data
    await registry.connect(alice)["safeTransferFrom(address,address,uint256)"](
      alice.address,
      bob.address,
      tokenId
    );
    
    const [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps.length).to.equal(1);
  });
  
  it("should update ownership after safeTransferFrom with data", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    const data = "0x1234";
    
    await registry.connect(alice)["safeTransferFrom(address,address,uint256,bytes)"](
      alice.address,
      bob.address,
      tokenId,
      data
    );
    
    const [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps.length).to.equal(1);
  });
});

describe("Multiple Transfer Scenarios", function () {
  it("should handle chain of transfers (A→B→C)", async function () {
    const { registry, alice, bob, charlie } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Alice → Bob
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    let [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps.length).to.equal(1);
    
    // Bob → Charlie
    await registry.connect(bob).transferFrom(bob.address, charlie.address, tokenId);
    
    [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps.length).to.equal(0);
    
    const [charlieApps] = await registry.getAppsByOwner(charlie.address, 0);
    expect(charlieApps.length).to.equal(1);
    
    // Verify original minter still alice
    expect(charlieApps[0].minter).to.equal(alice.address);
  });
  
  it("should handle multiple apps transferred between users", async function () {
    const { registry, alice, bob, charlie } = await loadFixture(deployFixture);
    
    // Alice mints 5 apps
    const tokenIds = [];
    for (let i = 0; i < 5; i++) {
      await registry.connect(alice).mint(
        `did:test:app${i}`,
        [INTERFACE_TYPES.API],
        `https://example.com/data${i}`,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`)),
        "keccak256",
        `token${i}`,
        `contract${i}`,
        1, // major
        0, // minor
        0, // patch
        [],
        ""
      );
      tokenIds.push(i + 1); // Token IDs are sequential starting from 1
    }
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(5);
    
    // Transfer 3 to Bob, 2 to Charlie
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenIds[0]);
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenIds[1]);
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenIds[2]);
    await registry.connect(alice).transferFrom(alice.address, charlie.address, tokenIds[3]);
    await registry.connect(alice).transferFrom(alice.address, charlie.address, tokenIds[4]);
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(0);
    expect(await registry.getTotalAppsByOwner(bob.address)).to.equal(3);
    expect(await registry.getTotalAppsByOwner(charlie.address)).to.equal(2);
  });
  
  it("should handle transfer back to original minter", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Alice → Bob → Alice
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    await registry.connect(bob).transferFrom(bob.address, alice.address, tokenId);
    
    const [aliceApps] = await registry.getAppsByOwner(alice.address, 0);
    expect(aliceApps.length).to.equal(1);
    expect(aliceApps[0].minter).to.equal(alice.address);
  });
});

describe("Status Updates After Transfer", function () {
  it("new owner should be able to update status", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Transfer to bob
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    // Bob should be able to update status
    await registry.connect(bob).updateStatus("did:test:example", 1, 1); // Deprecated
    
    const [bobApps] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps[0].status).to.equal(1);
  });
  
  it("old owner should NOT be able to update status after transfer", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    // Alice should NOT be able to update
    await expect(
      registry.connect(alice).updateStatus("did:test:example", 1, 1)
    ).to.be.revertedWithCustomError(registry, "NotAppOwner");
  });
});

describe("Pagination After Transfers", function () {
  it("should paginate correctly after transfers", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    // Alice mints 10 apps
    for (let i = 0; i < 10; i++) {
      await registry.connect(alice).mint(
        `did:test:app${i}`,
        [INTERFACE_TYPES.API],
        `https://example.com/data${i}`,
        hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`Test App ${i} data`)),
        "keccak256",
        `token${i}`,
        `contract${i}`,
        1, // major
        0, // minor
        0, // patch
        [],
        ""
      );
    }
    
    // Transfer 5 to bob
    for (let i = 1; i <= 5; i++) {
      await registry.connect(alice).transferFrom(alice.address, bob.address, i);
    }
    
    // Test pagination for alice (should have 5 apps)
    const [aliceApps1] = await registry.getAppsByOwner(alice.address, 0);
    expect(aliceApps1.length).to.equal(5);
    
    // Test pagination for bob (should have 5 apps)
    const [bobApps1] = await registry.getAppsByOwner(bob.address, 0);
    expect(bobApps1.length).to.equal(5);
  });
});

describe("Transfer Edge Cases", function () {
  it("should handle transfer to self (no-op but shouldn't break)", async function () {
    const { registry, alice } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    await registry.connect(alice).transferFrom(alice.address, alice.address, tokenId);
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(1);
  });
  
  it("should handle rapid back-and-forth transfers", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Transfer back and forth 10 times
    for (let i = 0; i < 10; i++) {
      await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
      await registry.connect(bob).transferFrom(bob.address, alice.address, tokenId);
    }
    
    expect(await registry.getTotalAppsByOwner(alice.address)).to.equal(1);
    expect(await registry.getTotalAppsByOwner(bob.address)).to.equal(0);
  });
});

describe("Transfer + Status Integration", function () {
  it("getAppsByStatus should respect new owner after transfer", async function () {
    const { registry, alice, bob } = await loadFixture(deployFixture);
    
    await registry.connect(alice).mint(
      "did:test:example",
      [INTERFACE_TYPES.API],
      "https://example.com/data",
      hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Test App data")),
      "keccak256",
      "token123",
      "contract456",
      1, // major
      0, // minor
      0, // patch
      [],
      ""
    );
    
    const tokenId = 1; // First minted token
    
    // Set to deprecated (only owner can see)
    await registry.connect(alice).updateStatus("did:test:example", 1, 1);
    
    // Alice should see it in her deprecated apps
    let [aliceDeprecated] = await registry.connect(alice).getAppsByStatus(1, 0);
    expect(aliceDeprecated.length).to.equal(1);
    
    // Transfer to bob
    await registry.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    
    // Alice should NOT see it anymore
    [aliceDeprecated] = await registry.connect(alice).getAppsByStatus(1, 0);
    expect(aliceDeprecated.length).to.equal(0);
    
    // Bob should see it
    const [bobDeprecated] = await registry.connect(bob).getAppsByStatus(1, 0);
    expect(bobDeprecated.length).to.equal(1);
  });
});