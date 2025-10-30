// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IOMA3DataUrlAttestationStore.sol";

interface IOMA3Resolver {
    /// @notice Return the address considered current controller/owner for a DID.
    function currentOwner(bytes32 didHash) external view returns (address);

    /// @notice Check if a data hash has a valid attestation for a DID.
    function checkDataHashAttestation(bytes32 didHash, bytes32 dataHash) external view returns (bool);
}
