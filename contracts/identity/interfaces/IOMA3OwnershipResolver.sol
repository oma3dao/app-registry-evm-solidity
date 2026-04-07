// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOMA3OwnershipResolver
/// @notice Interface for resolving DID ownership to an address.
/// @dev Separated from data URL resolution to allow independent contract implementations.
interface IOMA3OwnershipResolver {
    /// @notice Return the address considered current controller/owner for a DID.
    function currentOwner(bytes32 didHash) external view returns (address);
}
