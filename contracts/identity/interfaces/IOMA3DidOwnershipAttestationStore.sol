// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOMA3DidOwnershipAttestationStore
/// @notice Minimal surface for DID ownership attestations (ephemeral).
/// @dev Core ownership data only; rich metadata belongs in EAS. Future Hubs can implement this AND a general IAttestationStore. Detect via ERC-165.
interface IOMA3DidOwnershipAttestationStore {
    /// @notice Current materialized entry for (issuer, didHash).
    struct Entry {
        bool    active;         // false on revoke
        uint64  recordedAt;     // block.timestamp at accept time
        uint64  recordedBlock;  // block.number at accept time
        uint64  expiresAt;      // 0 = non-expiring
        bytes32 controllerAddress; // controller address (bytes32(uint160(address)))
    }

    // ---------- READ ----------
    function get(address issuer, bytes32 didHash) external view returns (Entry memory);
    function hasActive(address issuer, bytes32 didHash)
        external view returns (bool ok, bytes32 controllerAddress, uint64 expiresAt);

    // ---------- WRITE (direct) ----------
    function upsertDirect(bytes32 didHash, bytes32 controllerAddress, uint64 expiresAt) external;
    function revokeDirect(bytes32 didHash) external;

    // ---------- WRITE (delegated, EIP-712) ----------
    struct Delegated {
        address issuer;
        bytes32 didHash;
        bytes32 controllerAddress; // controller address being attested
        uint64  expiresAt;
        uint64  deadline;
        uint256 nonce;
    }
    function upsertDelegated(Delegated calldata att, bytes calldata sig) external;
    function revokeDelegated(
        address issuer, bytes32 didHash, uint64 deadline, uint256 nonce, bytes calldata sig
    ) external;

    // ---------- EVENTS ----------
    event Upsert(
        address indexed issuer,
        bytes32 indexed didHash,
        bytes32 controllerAddress,
        uint64  expiresAt,
        uint64  recordedAt,
        uint64  recordedBlock
    );

    event Revoke(
        address indexed issuer,
        bytes32 indexed didHash,
        uint64  recordedAt,
        uint64  recordedBlock
    );
}
