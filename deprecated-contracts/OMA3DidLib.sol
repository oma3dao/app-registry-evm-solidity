// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OMA3DidLib
 * @dev Library for DID normalization and validation
 * @notice Off-chain authoritative normalization: clients must pre-normalize did:web hosts to punycode ASCII
 * @notice On-chain minimal verification: lowercase host segment + safety checks only
 * @notice Includes generic DID Index Address mapping for ecosystem compatibility
 */
library OMA3DidLib {
    error DID_PREFIX();      // DID must start with "did:"
    error DID_LENGTH();      // DID exceeds 256 bytes
    error DID_CHARACTER();   // Invalid character in DID

    /**
     * @dev Compute normalized DID hash
     * @param did The DID string to hash
     * @return didHash The keccak256 hash of the normalized DID
     */
    function hash(string memory did) internal pure returns (bytes32) {
        return keccak256(bytes(normalize(did)));
    }

    /**
     * @dev Normalize DID for consistent hashing
     * @param did The DID string to normalize
     * @return The normalized DID string
     * @notice Only performs minimal on-chain normalization:
     * - Validates DID prefix and basic structure
     * - Rejects spaces and control characters
     * - Lowercases did:web host segment only
     * - Clients must handle punycode/IDNA normalization off-chain
     */
    function normalize(string memory did) internal pure returns (string memory) {
        bytes memory didBytes = bytes(did);
        uint256 len = didBytes.length;

        // Basic validation
        if (!(len >= 4 && didBytes[0] == 'd' && didBytes[1] == 'i' && didBytes[2] == 'd' && didBytes[3] == ':')) {
            revert DID_PREFIX();
        }
        if (len > 256) {
            revert DID_LENGTH();
        }

        // Reject spaces and control characters (<= 0x20) and DEL (0x7f)
        for (uint256 i = 0; i < len; i++) {
            bytes1 char = didBytes[i];
            if (uint8(char) <= 0x20 || char == 0x7f) {
                revert DID_CHARACTER();
            }
        }

        // Special handling for did:web host lowercasing
        // did:web normalization:
        // - Host is substring [8..iEnd) in "did:web:<host>[/path]"
        // - We lowercase A-Z in host only. Ports, path, and percent-encoding are preserved.
        // - IDNA/punycode and default-port stripping are OFF-CHAIN (authoritative).
        if (len >= 8 && didBytes[4] == 'w' && didBytes[5] == 'e' && didBytes[6] == 'b' && didBytes[7] == ':') {
            // Copy bytes for modification (allocates full length for simplicity)
            bytes memory normalized = new bytes(len);
            for (uint256 i = 0; i < len; i++) {
                normalized[i] = didBytes[i];
            }

            // Lowercase host from index 8 up to first '/' or end
            uint256 iStart = 8;
            uint256 iEnd = len;
            for (uint256 i = iStart; i < len; i++) {
                if (didBytes[i] == '/') {
                    iEnd = i;
                    break;
                }
            }

            // Convert A-Z to a-z in host segment
            for (uint256 i = iStart; i < iEnd; i++) {
                bytes1 char = didBytes[i];
                if (char >= 0x41 && char <= 0x5A) { // A-Z
                    normalized[i] = bytes1(uint8(char) + 32); // Convert to a-z
                }
            }

            return string(normalized);
        }

        // Other DID methods pass through unchanged
        return did;
    }

    /**
     * @dev Validate DID format (basic checks without full normalization)
     * @param did The DID string to validate
     * @return True if DID passes basic validation
     */
    function isValid(string memory did) internal pure returns (bool) {
        bytes memory didBytes = bytes(did);
        uint256 len = didBytes.length;

        // Check minimum length and prefix
        if (len < 4 || didBytes[0] != 'd' || didBytes[1] != 'i' || didBytes[2] != 'd' || didBytes[3] != ':') {
            return false;
        }

        // Check maximum length
        if (len > 256) {
            return false;
        }

        // Check for invalid characters (same predicate as normalize())
        for (uint256 i = 0; i < len; i++) {
            bytes1 char = didBytes[i];
            if (uint8(char) <= 0x20 || char == 0x7f) {
                return false;
            }
        }

        return true;
    }

    /**
     * @dev Convert DID hash to DID Address for ecosystem compatibility
     * @param didHash The keccak256 hash of a normalized DID
     * @return didAddress The deterministic address mapped from the DID hash
     * @notice Simple truncation per OMATrust spec section 5.3.2: takes last 20 bytes of didHash
     */
    function hashToAddress(bytes32 didHash) internal pure returns (address) {
        return address(uint160(uint256(didHash)));
    }

    /**
     * @dev Convert DID string to DID Address (convenience function)
     * @param did The DID string to convert
     * @return didAddress The deterministic address mapped from the DID
     * @notice Combines normalization, hashing, and address truncation in one call
     */
    function toAddress(string memory did) internal pure returns (address) {
        bytes32 didHash = hash(did);
        return hashToAddress(didHash);
    }
}
