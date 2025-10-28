// SPDX-License-Identifier: MIT

pragma solidity 0.8.28;

import { SchemaResolver } from "./SchemaResolver.sol";
import { IEAS, Attestation } from "../IEAS.sol";

/// @title RateLimitResolver
/// @notice A schema resolver that limits the number of attestations per attester within a time window.
/// @dev Useful for preventing spam on gasless attestation schemas.
contract RateLimitResolver is SchemaResolver {
    error RateLimitExceeded();
    error Unauthorized();

    // Time window for rate limiting (e.g., 1 day = 86400 seconds)
    uint256 public immutable timeWindow;
    
    // Maximum attestations allowed per attester within the time window
    uint256 public immutable maxAttestations;
    
    // Optional: Admin address that can bypass rate limits (e.g., for your relayer)
    address public immutable admin;

    // Track attestation counts per attester
    // attester => window start timestamp => count
    mapping(address => mapping(uint256 => uint256)) private _attestationCounts;

    /// @dev Creates a new RateLimitResolver.
    /// @param eas The address of the global EAS contract.
    /// @param _timeWindow The time window in seconds (e.g., 86400 for 1 day).
    /// @param _maxAttestations Maximum attestations allowed per time window.
    /// @param _admin Optional admin address that can bypass limits (use address(0) for none).
    constructor(
        IEAS eas,
        uint256 _timeWindow,
        uint256 _maxAttestations,
        address _admin
    ) SchemaResolver(eas) {
        require(_timeWindow > 0, "Time window must be positive");
        require(_maxAttestations > 0, "Max attestations must be positive");
        
        timeWindow = _timeWindow;
        maxAttestations = _maxAttestations;
        admin = _admin;
    }

    /// @notice Checks if an attestation is allowed based on rate limits.
    /// @param attestation The new attestation.
    /// @return Whether the attestation is valid.
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    ) internal override returns (bool) {
        address attester = attestation.attester;
        
        // Admin bypass (e.g., for trusted relayer or system attestations)
        if (admin != address(0) && attester == admin) {
            return true;
        }

        // Calculate current time window
        uint256 currentWindow = block.timestamp / timeWindow;
        
        // Get current count for this attester in this window
        uint256 currentCount = _attestationCounts[attester][currentWindow];
        
        // Check if limit exceeded
        if (currentCount >= maxAttestations) {
            revert RateLimitExceeded();
        }
        
        // Increment count
        _attestationCounts[attester][currentWindow] = currentCount + 1;
        
        return true;
    }

    /// @notice Allows revocations without rate limiting.
    /// @return Always returns true.
    function onRevoke(
        Attestation calldata /*attestation*/,
        uint256 /*value*/
    ) internal pure override returns (bool) {
        return true;
    }

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
        // Admin has unlimited
        if (admin != address(0) && attester == admin) {
            return type(uint256).max;
        }
        
        uint256 currentWindow = block.timestamp / timeWindow;
        uint256 currentCount = _attestationCounts[attester][currentWindow];
        
        if (currentCount >= maxAttestations) {
            return 0;
        }
        
        return maxAttestations - currentCount;
    }

    /// @notice Gets the timestamp when the current rate limit window resets.
    /// @return The Unix timestamp when the window resets.
    function getWindowResetTime() external view returns (uint256) {
        uint256 currentWindow = block.timestamp / timeWindow;
        return (currentWindow + 1) * timeWindow;
    }
}
