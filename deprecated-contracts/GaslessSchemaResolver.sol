// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SchemaResolver } from "../SchemaResolver.sol";
import { IEAS, Attestation } from "../../IEAS.sol";

/// @title GaslessSchemaResolver
/// @notice A comprehensive resolver for gasless attestation schemas with spam prevention.
/// @dev Combines rate limiting, trusted relayer verification, and optional recipient whitelisting.
contract GaslessSchemaResolver is SchemaResolver {
    error RateLimitExceeded();
    error UntrustedRelayer();
    error RecipientNotWhitelisted();
    error Unauthorized();

    // Owner for administrative functions
    address public owner;
    
    // Trusted relayer that submits gasless attestations
    address public trustedRelayer;
    
    // Rate limiting parameters
    uint256 public timeWindow;
    uint256 public maxAttestationsPerWindow;
    
    // Whether recipient whitelisting is enabled
    bool public recipientWhitelistEnabled;
    
    // Track attestation counts per attester (the actual user, not the relayer)
    mapping(address => mapping(uint256 => uint256)) private _attestationCounts;
    
    // Optional: Whitelist of allowed recipients
    mapping(address => bool) public whitelistedRecipients;

    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event RateLimitUpdated(uint256 timeWindow, uint256 maxAttestations);
    event RecipientWhitelisted(address indexed recipient, bool status);
    event RecipientWhitelistToggled(bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    /// @dev Creates a new GaslessSchemaResolver.
    /// @param eas The address of the global EAS contract.
    /// @param _trustedRelayer The address of the trusted relayer (your backend).
    /// @param _timeWindow The time window in seconds for rate limiting (e.g., 86400 for 1 day).
    /// @param _maxAttestations Maximum attestations per attester per time window.
    constructor(
        IEAS eas,
        address _trustedRelayer,
        uint256 _timeWindow,
        uint256 _maxAttestations
    ) SchemaResolver(eas) {
        require(_trustedRelayer != address(0), "Invalid relayer address");
        require(_timeWindow > 0, "Time window must be positive");
        require(_maxAttestations > 0, "Max attestations must be positive");
        
        owner = msg.sender;
        trustedRelayer = _trustedRelayer;
        timeWindow = _timeWindow;
        maxAttestationsPerWindow = _maxAttestations;
        recipientWhitelistEnabled = false;
    }

    /// @notice Validates an attestation based on multiple criteria.
    /// @param attestation The new attestation.
    /// @return Whether the attestation is valid.
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal override returns (bool) {
        // 1. Verify attestation comes from trusted relayer
        // Note: In delegated attestations, tx.origin is the relayer, attestation.attester is the actual user
        if (tx.origin != trustedRelayer) {
            revert UntrustedRelayer();
        }

        // 2. Check recipient whitelist if enabled
        if (recipientWhitelistEnabled && !whitelistedRecipients[attestation.recipient]) {
            revert RecipientNotWhitelisted();
        }

        // 3. Apply rate limiting to the actual attester (not the relayer)
        address attester = attestation.attester;
        uint256 currentWindow = block.timestamp / timeWindow;
        uint256 currentCount = _attestationCounts[attester][currentWindow];
        
        if (currentCount >= maxAttestationsPerWindow) {
            revert RateLimitExceeded();
        }
        
        // Increment count
        _attestationCounts[attester][currentWindow] = currentCount + 1;
        
        return true;
    }

    /// @notice Allows revocations without restrictions.
    /// @return Always returns true.
    function onRevoke(
        Attestation calldata /*attestation*/,
        uint256 /*value*/
    ) internal pure override returns (bool) {
        return true;
    }

    // ============ View Functions ============

    /// @notice Gets the current attestation count for an attester.
    /// @param attester The attester address to check.
    /// @return The number of attestations made in the current time window.
    function getAttestationCount(address attester) external view returns (uint256) {
        uint256 currentWindow = block.timestamp / timeWindow;
        return _attestationCounts[attester][currentWindow];
    }

    /// @notice Gets the remaining attestations allowed for an attester.
    /// @param attester The attester address to check.
    /// @return The number of attestations remaining in the current time window.
    function getRemainingAttestations(address attester) external view returns (uint256) {
        uint256 currentWindow = block.timestamp / timeWindow;
        uint256 currentCount = _attestationCounts[attester][currentWindow];
        
        if (currentCount >= maxAttestationsPerWindow) {
            return 0;
        }
        
        return maxAttestationsPerWindow - currentCount;
    }

    /// @notice Gets the timestamp when the current rate limit window resets.
    /// @return The Unix timestamp when the window resets.
    function getWindowResetTime() external view returns (uint256) {
        uint256 currentWindow = block.timestamp / timeWindow;
        return (currentWindow + 1) * timeWindow;
    }

    // ============ Admin Functions ============

    /// @notice Updates the trusted relayer address.
    /// @param newRelayer The new relayer address.
    function setTrustedRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "Invalid relayer address");
        address oldRelayer = trustedRelayer;
        trustedRelayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }

    /// @notice Updates rate limiting parameters.
    /// @param newTimeWindow The new time window in seconds.
    /// @param newMaxAttestations The new maximum attestations per window.
    function setRateLimit(uint256 newTimeWindow, uint256 newMaxAttestations) external onlyOwner {
        require(newTimeWindow > 0, "Time window must be positive");
        require(newMaxAttestations > 0, "Max attestations must be positive");
        
        timeWindow = newTimeWindow;
        maxAttestationsPerWindow = newMaxAttestations;
        emit RateLimitUpdated(newTimeWindow, newMaxAttestations);
    }

    /// @notice Enables or disables recipient whitelisting.
    /// @param enabled Whether to enable recipient whitelisting.
    function setRecipientWhitelistEnabled(bool enabled) external onlyOwner {
        recipientWhitelistEnabled = enabled;
        emit RecipientWhitelistToggled(enabled);
    }

    /// @notice Adds or removes a recipient from the whitelist.
    /// @param recipient The recipient address.
    /// @param status Whether the recipient is whitelisted.
    function setRecipientWhitelist(address recipient, bool status) external onlyOwner {
        whitelistedRecipients[recipient] = status;
        emit RecipientWhitelisted(recipient, status);
    }

    /// @notice Batch updates recipient whitelist.
    /// @param recipients Array of recipient addresses.
    /// @param statuses Array of whitelist statuses.
    function batchSetRecipientWhitelist(
        address[] calldata recipients,
        bool[] calldata statuses
    ) external onlyOwner {
        require(recipients.length == statuses.length, "Length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            whitelistedRecipients[recipients[i]] = statuses[i];
            emit RecipientWhitelisted(recipients[i], statuses[i]);
        }
    }

    /// @notice Transfers ownership of the resolver.
    /// @param newOwner The new owner address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
