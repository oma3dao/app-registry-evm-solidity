// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOMA3DataUrlResolver
/// @notice Interface for verifying data hash attestations for a DID.
/// @dev Separated from ownership resolution to allow independent contract implementations.
interface IOMA3DataUrlResolver {
    /// @notice Check if a data hash has a valid attestation for a DID.
    function checkDataHashAttestation(bytes32 didHash, bytes32 dataHash) external view returns (bool);
}
