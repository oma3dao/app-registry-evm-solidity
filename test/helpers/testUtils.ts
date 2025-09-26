import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Test utilities for OMA3ResolverWithStore testing
 */

export class TestHelper {
    // Constants
    static readonly MATURATION_SECONDS = 172800; // 48 hours
    static readonly MAX_TTL_SECONDS = 63072000; // 2 years
    static readonly SHORT_MATURATION = 10; // 10 seconds for testing
    
    // Standard test DIDs and hashes
    static readonly TEST_DID = "did:oma3:test";
    static readonly TEST_DID_HASH = ethers.keccak256(ethers.toUtf8Bytes(TestHelper.TEST_DID));
    static readonly TEST_DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("test-data-content"));
    
    // Additional test data
    static readonly TEST_DID_2 = "did:oma3:test2";
    static readonly TEST_DID_2_HASH = ethers.keccak256(ethers.toUtf8Bytes(TestHelper.TEST_DID_2));
    static readonly TEST_DATA_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("test-data-content-2"));

    /**
     * Convert an address to bytes32 format for controller addresses
     */
    static addressToBytes32(address: string): string {
        return ethers.zeroPadValue(address, 32);
    }

    /**
     * Generate a future timestamp for testing expiry
     */
    static futureTimestamp(offsetSeconds: number = 3600): number {
        return Math.floor(Date.now() / 1000) + offsetSeconds;
    }

    /**
     * Generate a past timestamp for testing expiry
     */
    static pastTimestamp(offsetSeconds: number = 3600): number {
        return Math.floor(Date.now() / 1000) - offsetSeconds;
    }

    /**
     * Generate test data hash from string
     */
    static generateDataHash(content: string): string {
        return ethers.keccak256(ethers.toUtf8Bytes(content));
    }

    /**
     * Generate test DID hash from DID string
     */
    static generateDidHash(did: string): string {
        return ethers.keccak256(ethers.toUtf8Bytes(did));
    }

    /**
     * Create EIP-712 domain for resolver contract
     */
    static async createEIP712Domain(resolverAddress: string, chainId?: bigint): Promise<any> {
        if (!chainId) {
            chainId = (await ethers.provider.getNetwork()).chainId;
        }

        return {
            name: "DIDOwnership",
            version: "1",
            chainId: chainId,
            verifyingContract: resolverAddress
        };
    }

    /**
     * EIP-712 types for delegated operations
     */
    static readonly DELEGATED_TYPES = {
        Delegated: [
            { name: "issuer", type: "address" },
            { name: "didHash", type: "bytes32" },
            { name: "controllerAddress", type: "bytes32" },
            { name: "expiresAt", type: "uint64" },
            { name: "deadline", type: "uint64" },
            { name: "nonce", type: "uint256" }
        ]
    };

    static readonly DELEGATED_REVOKE_TYPES = {
        DelegatedRevoke: [
            { name: "issuer", type: "address" },
            { name: "didHash", type: "bytes32" },
            { name: "deadline", type: "uint64" },
            { name: "nonce", type: "uint256" }
        ]
    };

    /**
     * Create a signed delegated upsert request
     */
    static async createDelegatedUpsert(
        signer: SignerWithAddress,
        resolverAddress: string,
        didHash: string,
        controllerAddress: string,
        expiresAt: number = 0,
        deadline?: number,
        nonce: number = 1
    ): Promise<{ delegated: any, signature: string }> {
        if (!deadline) {
            deadline = TestHelper.futureTimestamp();
        }

        const domain = await TestHelper.createEIP712Domain(resolverAddress);
        
        const delegated = {
            issuer: signer.address,
            didHash: didHash,
            controllerAddress: ethers.zeroPadValue(controllerAddress, 32),
            expiresAt: expiresAt,
            deadline: deadline,
            nonce: nonce
        };

        const signature = await signer.signTypedData(domain, TestHelper.DELEGATED_TYPES, delegated);
        
        return { delegated, signature };
    }

    /**
     * Create a signed delegated revoke request
     */
    static async createDelegatedRevoke(
        signer: SignerWithAddress,
        resolverAddress: string,
        didHash: string,
        deadline?: number,
        nonce: number = 1
    ): Promise<{ revokeData: any, signature: string }> {
        if (!deadline) {
            deadline = TestHelper.futureTimestamp();
        }

        const domain = await TestHelper.createEIP712Domain(resolverAddress);
        
        const revokeData = {
            issuer: signer.address,
            didHash: didHash,
            deadline: deadline,
            nonce: nonce
        };

        const signature = await signer.signTypedData(domain, TestHelper.DELEGATED_REVOKE_TYPES, revokeData);
        
        return { revokeData, signature };
    }

    /**
     * Fast forward time for testing maturation and expiry
     */
    static async fastForward(seconds: number): Promise<void> {
        await time.increase(seconds);
    }

    /**
     * Fast forward past maturation window
     */
    static async fastForwardPastMaturation(): Promise<void> {
        await TestHelper.fastForward(TestHelper.MATURATION_SECONDS + 1);
    }

    /**
     * Fast forward past short maturation window (for testing)
     */
    static async fastForwardPastShortMaturation(): Promise<void> {
        await TestHelper.fastForward(TestHelper.SHORT_MATURATION + 1);
    }

    /**
     * Verify entry matches expected values
     */
    static verifyEntry(
        entry: any,
        expectedActive: boolean,
        expectedController?: string,
        expectedExpiresAt?: number
    ): void {
        if (expectedActive !== entry.active) {
            throw new Error(`Entry active mismatch: expected ${expectedActive}, got ${entry.active}`);
        }
        
        if (expectedController && expectedController !== entry.controllerAddress) {
            throw new Error(`Entry controller mismatch: expected ${expectedController}, got ${entry.controllerAddress}`);
        }
        
        if (expectedExpiresAt !== undefined && expectedExpiresAt !== entry.expiresAt) {
            throw new Error(`Entry expiresAt mismatch: expected ${expectedExpiresAt}, got ${entry.expiresAt}`);
        }
    }

    /**
     * Verify data entry matches expected values
     */
    static verifyDataEntry(
        dataEntry: any,
        expectedActive: boolean,
        expectedAttester?: string,
        expectedExpiresAt?: number
    ): void {
        if (expectedActive !== dataEntry.active) {
            throw new Error(`Data entry active mismatch: expected ${expectedActive}, got ${dataEntry.active}`);
        }
        
        if (expectedAttester) {
            const attesterAddress = ethers.getAddress("0x" + dataEntry.attester.slice(-40));
            if (expectedAttester !== attesterAddress) {
                throw new Error(`Data entry attester mismatch: expected ${expectedAttester}, got ${attesterAddress}`);
            }
        }
        
        if (expectedExpiresAt !== undefined && expectedExpiresAt !== dataEntry.expiresAt) {
            throw new Error(`Data entry expiresAt mismatch: expected ${expectedExpiresAt}, got ${dataEntry.expiresAt}`);
        }
    }
}

/**
 * Mock wallet addresses for testing scenarios
 */
export class MockWallets {
    static readonly ISSUER_1 = "0x1111111111111111111111111111111111111111";
    static readonly ISSUER_2 = "0x2222222222222222222222222222222222222222"; 
    static readonly USER_1 = "0x3333333333333333333333333333333333333333";
    static readonly USER_2 = "0x4444444444444444444444444444444444444444";
    static readonly ATTACKER = "0x5555555555555555555555555555555555555555";
}

/**
 * Test scenario builders for complex integration tests
 */
export class TestScenarios {
    /**
     * Create a basic ownership scenario
     */
    static async basicOwnership(
        resolver: any,
        issuer: SignerWithAddress,
        controller: SignerWithAddress,
        didHash?: string,
        expiresAt?: number
    ): Promise<void> {
        const dh = didHash || TestHelper.TEST_DID_HASH;
        const controllerBytes32 = TestHelper.addressToBytes32(controller.address);
        const exp = expiresAt || 0;
        
        await resolver.connect(issuer).upsertDirect(dh, controllerBytes32, exp);
    }

    /**
     * Create a basic data attestation scenario
     */
    static async basicDataAttestation(
        resolver: any,
        issuer: SignerWithAddress,
        didHash?: string,
        dataHash?: string,
        expiresAt?: number
    ): Promise<void> {
        const dh = didHash || TestHelper.TEST_DID_HASH;
        const datah = dataHash || TestHelper.TEST_DATA_HASH;
        const exp = expiresAt || 0;
        
        await resolver.connect(issuer).attestDataHash(dh, datah, exp);
    }

    /**
     * Create competing ownership claims scenario
     */
    static async competingOwnership(
        resolver: any,
        issuer1: SignerWithAddress,
        issuer2: SignerWithAddress,
        controller1: SignerWithAddress,
        controller2: SignerWithAddress,
        didHash?: string
    ): Promise<void> {
        const dh = didHash || TestHelper.TEST_DID_HASH;
        const controller1Bytes32 = TestHelper.addressToBytes32(controller1.address);
        const controller2Bytes32 = TestHelper.addressToBytes32(controller2.address);
        
        await resolver.connect(issuer1).upsertDirect(dh, controller1Bytes32, 0);
        await resolver.connect(issuer2).upsertDirect(dh, controller2Bytes32, 0);
    }
}
