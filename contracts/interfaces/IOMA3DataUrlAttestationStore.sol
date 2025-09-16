// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOMA3DataUrlAttestationStore
/// @notice Minimal surface for data URL hash attestations (ephemeral).
/// @dev Separate from ownership attestations for better separation of concerns.
/// @dev Focused on verifying data integrity for app manifests and metadata.
interface IOMA3DataUrlAttestationStore {
    /// @notice Current materialized entry for (issuer, didHash, dataHash).
    struct DataEntry {
        bool    active;         // false on revoke
        uint64  recordedAt;     // block.timestamp at accept time
        uint64  recordedBlock;  // block.number at accept time
        uint64  expiresAt;      // 0 = non-expiring
        bytes32 attester;       // attester address (bytes32(uint160(address)))
    }

    // ---------- READ ----------
    function getDataEntry(address issuer, bytes32 didHash, bytes32 dataHash)
        external view returns (DataEntry memory);
    function isDataHashValid(bytes32 didHash, bytes32 dataHash)
        external view returns (bool);

    // ---------- WRITE (direct) ----------
    function attestDataHash(bytes32 didHash, bytes32 dataHash, uint64 expiresAt) external;
    function revokeDataHash(bytes32 didHash, bytes32 dataHash) external;

    // ---------- EVENTS ----------
    event DataHashAttested(
        address indexed issuer,
        bytes32 indexed didHash,
        bytes32 indexed dataHash,
        uint64  expiresAt,
        uint64  recordedAt,
        uint64  recordedBlock
    );

    event DataHashRevoked(
        address indexed issuer,
        bytes32 indexed didHash,
        bytes32 indexed dataHash,
        uint64  recordedAt,
        uint64  recordedBlock
    );
}
