// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./OMA3AppRegistry.sol";
import "./OMA3AppMetadata.sol";

/**
 * @title OMA3SystemFactory
 * @notice Factory contract for deploying and linking OMA3AppRegistry and OMA3AppMetadata contracts
 * @dev This contract deploys both contracts, links them together, and transfers ownership to the deployer
 * 
 * Security considerations:
 * - One-time use only (self-destructs after deployment)
 * - Minimal attack surface for auditing
 * - No fund handling or complex business logic
 * - Uses CREATE2 for deterministic deployment addresses
 */
contract OMA3SystemFactory {
    
    /// @notice Emitted when the OMA3 system is successfully deployed
    event SystemDeployed(
        address indexed deployer,
        address indexed registry,
        address indexed metadata,
        bytes32 registrySalt,
        bytes32 metadataSalt,
        uint256 timestamp
    );

    /// @notice Indicates whether the factory has been used
    bool public deployed = false;

    /**
     * @notice Deploy the complete OMA3 system (Registry + Metadata + Linking)
     * @param salt Custom salt for deterministic deployment (optional, use 0 for default)
     * @return registryAddress Address of the deployed registry contract
     * @return metadataAddress Address of the deployed metadata contract
     */
    function deploySystem(bytes32 salt) 
        external 
        returns (address registryAddress, address metadataAddress) 
    {
        require(!deployed, "Factory already used");
        deployed = true;

        // Generate deterministic salts
        bytes32 metadataSalt = keccak256(abi.encodePacked(msg.sender, salt, "metadata"));
        bytes32 registrySalt = keccak256(abi.encodePacked(msg.sender, salt, "registry"));

        // Deploy contracts using CREATE2 for deterministic addresses
        OMA3AppMetadata metadata = new OMA3AppMetadata{salt: metadataSalt}();
        OMA3AppRegistry registry = new OMA3AppRegistry{salt: registrySalt}();

        // Get deployed addresses
        metadataAddress = address(metadata);
        registryAddress = address(registry);

        // Link the contracts
        registry.setMetadataContract(metadataAddress);
        metadata.setAuthorizedRegistry(registryAddress);

        // Transfer ownership to the deployer
        registry.transferOwnership(msg.sender);
        metadata.transferOwnership(msg.sender);

        // Emit deployment event
        emit SystemDeployed(
            msg.sender,
            registryAddress,
            metadataAddress,
            registrySalt,
            metadataSalt,
            block.timestamp
        );

        // Optional: Self-destruct to minimize ongoing attack surface
        // Uncomment if you want the factory to be single-use only
        // selfdestruct(payable(msg.sender));

        return (registryAddress, metadataAddress);
    }

    /**
     * @notice Predict the addresses that would be deployed for a given deployer and salt
     * @param deployer Address of the account that will deploy
     * @param salt Custom salt for deployment
     * @return registryAddress Predicted address of the registry contract
     * @return metadataAddress Predicted address of the metadata contract
     */
    function predictAddresses(address deployer, bytes32 salt)
        external
        view
        returns (address registryAddress, address metadataAddress)
    {
        // Generate the same salts as deploySystem would use
        bytes32 metadataSalt = keccak256(abi.encodePacked(deployer, salt, "metadata"));
        bytes32 registrySalt = keccak256(abi.encodePacked(deployer, salt, "registry"));

        // Predict addresses using CREATE2
        bytes32 metadataHash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                metadataSalt,
                keccak256(type(OMA3AppMetadata).creationCode)
            )
        );

        bytes32 registryHash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                registrySalt,
                keccak256(type(OMA3AppRegistry).creationCode)
            )
        );

        metadataAddress = address(uint160(uint256(metadataHash)));
        registryAddress = address(uint160(uint256(registryHash)));

        return (registryAddress, metadataAddress);
    }

    /**
     * @notice Get deployment information (for verification)
     * @return isUsed Whether the factory has been used
     * @return factoryAddress Address of this factory
     */
    function getInfo() external view returns (bool isUsed, address factoryAddress) {
        return (deployed, address(this));
    }
}
