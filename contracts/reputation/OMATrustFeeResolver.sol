// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SchemaResolver } from "../../deps/eas/resolver/SchemaResolver.sol";
import { IEAS, Attestation } from "../../deps/eas/IEAS.sol";

/// @title OMATrustFeeResolver
/// @notice Minimal fixed-fee resolver for EAS attestations.
/// @dev Charges exact fee per attestation, forwards immediately to treasury.
///      No admin functions, no upgradability. Gnosis Safe compatible.
///      
///      Design intent: This resolver is intentionally minimal. It enforces a flat
///      protocol fee and immediately forwards it. All economic policy, rebates,
///      and revenue allocation occur outside this contract.
contract OMATrustFeeResolver is SchemaResolver {
    string public constant NAME = "OMATrust Fixed-Fee Resolver";
    string public constant VERSION = "1.0";

    /// @notice The exact fee required for each attestation (in wei)
    uint256 public immutable fee;

    /// @notice The address that receives all fees (typically a Gnosis Safe)
    address public immutable feeRecipient;

    /// @notice Thrown when attestation value doesn't match exact fee
    /// @param sent The amount of ETH sent with the attestation
    /// @param required The exact fee required
    error ExactFeeRequired(uint256 sent, uint256 required);

    /// @notice Thrown when fee transfer to recipient fails
    error FeeTransferFailed();

    /// @notice Creates a new fee resolver
    /// @param eas The address of the global EAS contract
    /// @param _fee The exact fee required per attestation (in wei)
    /// @param _feeRecipient The address to receive fees (must accept ETH)
    constructor(
        IEAS eas,
        uint256 _fee,
        address _feeRecipient
    ) SchemaResolver(eas) {
        require(_fee > 0, "Fee must be positive");
        require(_feeRecipient != address(0), "Invalid recipient");
        fee = _fee;
        feeRecipient = _feeRecipient;
    }

    /// @inheritdoc SchemaResolver
    function isPayable() public pure override returns (bool) {
        return true;
    }

    /// @notice Validates attestation and forwards fee to recipient
    /// @param value The ETH value sent with the attestation (must equal fee exactly)
    /// @return True if attestation is valid and fee was forwarded
    function onAttest(
        Attestation calldata /* attestation */,
        uint256 value
    ) internal override returns (bool) {
        if (value != fee) {
            revert ExactFeeRequired(value, fee);
        }

        (bool success, ) = feeRecipient.call{value: fee}("");
        if (!success) {
            revert FeeTransferFailed();
        }

        return true;
    }

    /// @notice Allows revocations unconditionally — no fee required.
    /// @dev Any ETH accidentally attached is recoverable via sweep().
    /// @return Always returns true
    function onRevoke(
        Attestation calldata /* attestation */,
        uint256 /* value */
    ) internal pure override returns (bool) {
        return true;
    }

    /// @notice Forwards any ETH balance in the resolver to feeRecipient.
    /// @dev Permissionless — anyone can call. No funds should ever sit in this contract.
    function sweep() external {
        (bool success, ) = feeRecipient.call{value: address(this).balance}("");
        if (!success) revert FeeTransferFailed();
    }
}
