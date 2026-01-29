// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../deprecated-contracts/OMA3DidLib.sol";

contract TestDidLib {
    using OMA3DidLib for string;

    function hash(string memory did) external pure returns (bytes32) {
        return OMA3DidLib.hash(did);
    }

    function normalize(string memory did) external pure returns (string memory) {
        return OMA3DidLib.normalize(did);
    }

    function isValid(string memory did) external pure returns (bool) {
        return OMA3DidLib.isValid(did);
    }

    function hashToAddress(bytes32 didHash) external pure returns (address) {
        return OMA3DidLib.hashToAddress(didHash);
    }

    function toAddress(string memory did) external pure returns (address) {
        return OMA3DidLib.toAddress(did);
    }
}
