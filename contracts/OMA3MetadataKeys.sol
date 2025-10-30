// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OMA3MetadataKeys
 * @dev Canonical metadata keys for OMATrust ERC-8004 integration
 * @notice These keys are used in MetadataEntry[] arrays for structured data passing
 */
library OMA3MetadataKeys {
    // Canonical key hashes (keccak256 of key strings)
    bytes32 constant DID = keccak256("omat.did");
    bytes32 constant DID_HASH = keccak256("omat.didHash");
    bytes32 constant DATA_HASH = keccak256("omat.dataHash");
    bytes32 constant DATA_HASH_ALGORITHM = keccak256("omat.dataHashAlgorithm");
    bytes32 constant STATUS = keccak256("omat.status");
    bytes32 constant INTERFACES = keccak256("omat.interfaces");
    bytes32 constant FUNGIBLE_TOKEN_ID = keccak256("omat.fungibleTokenId");
    bytes32 constant CONTRACT_ID = keccak256("omat.contractId");
    bytes32 constant VERSION_MAJOR = keccak256("omat.versionMajor");
    bytes32 constant VERSION_MINOR = keccak256("omat.versionMinor");
    bytes32 constant VERSION_PATCH = keccak256("omat.versionPatch");
    bytes32 constant TRAIT_HASHES = keccak256("omat.traitHashes");
    bytes32 constant METADATA_JSON = keccak256("omat.metadataJson");
    
    // Key strings (for off-chain use and documentation)
    string constant DID_STR = "omat.did";
    string constant DID_HASH_STR = "omat.didHash";
    string constant DATA_HASH_STR = "omat.dataHash";
    string constant DATA_HASH_ALGORITHM_STR = "omat.dataHashAlgorithm";
    string constant STATUS_STR = "omat.status";
    string constant INTERFACES_STR = "omat.interfaces";
    string constant FUNGIBLE_TOKEN_ID_STR = "omat.fungibleTokenId";
    string constant CONTRACT_ID_STR = "omat.contractId";
    string constant VERSION_MAJOR_STR = "omat.versionMajor";
    string constant VERSION_MINOR_STR = "omat.versionMinor";
    string constant VERSION_PATCH_STR = "omat.versionPatch";
    string constant TRAIT_HASHES_STR = "omat.traitHashes";
    string constant METADATA_JSON_STR = "omat.metadataJson";
}
