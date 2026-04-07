// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOMA3DidOwnershipAttestationStore.sol";
import "./interfaces/IOMA3DataUrlAttestationStore.sol";
import "./interfaces/IOMA3OwnershipResolver.sol";
import "./interfaces/IOMA3DataUrlResolver.sol";

contract OMA3ResolverWithStore is IOMA3DidOwnershipAttestationStore, IOMA3DataUrlAttestationStore, IOMA3OwnershipResolver, IOMA3DataUrlResolver, Ownable {
    // ---------- Storage ----------

    mapping(address => mapping(bytes32 => IOMA3DidOwnershipAttestationStore.Entry)) private _own;      // issuer => didHash => Entry
    mapping(address => mapping(uint256 => bool)) private _nonceUsed; // EIP-712 replay guard

    // Data hash attestations: issuer => didHash => dataHash => DataEntry
    mapping(address => mapping(bytes32 => mapping(bytes32 => IOMA3DataUrlAttestationStore.DataEntry))) private _data;

    // Stored registration parameters for ERC-8004 tokenURI-only registration
    struct RegistrationStoredParams {
        string didString;
        uint16 interfaces;
        string tokenURI;
        bytes32 dataHash;
        uint8 dataHashAlgorithm;
        string fungibleTokenId;
        string contractId;
        uint8 initialVersionMajor;
        uint8 initialVersionMinor;
        uint8 initialVersionPatch;
        bytes32[] traitHashes;
        string metadataJson;
        uint64 expiresAt;
        bool exists;
    }
    
    mapping(address => RegistrationStoredParams) private _registrationStoredParams;

    // Policy configuration (simplified for v1)
    mapping(address => bool) public isIssuer;        // allowlisted attestation issuers
    address[] public authorizedIssuers;              // array for iteration
    uint64 public maturationSeconds;                 // maturation period for ownership changes
    uint64 public maxTTLSeconds;                     // maximum TTL cap

    /// @notice Constructor - sets the deployer as owner and default policy values
    constructor() Ownable(msg.sender) {
        maturationSeconds = 172800;      // 48 hours (48 * 60 * 60)
        maxTTLSeconds = 63072000;        // 2 years (2 * 365 * 24 * 60 * 60)
    }

    // ---------- EIP-712 ----------
    string public constant NAME = "DIDOwnership";
    string public constant VERSION = "1";
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant DELEGATED_UPSERT_TYPEHASH =
        keccak256("Delegated(address issuer,bytes32 didHash,bytes32 controllerAddress,uint64 expiresAt,uint64 deadline,uint256 nonce)");
    bytes32 private constant DELEGATED_REVOKE_TYPEHASH =
        keccak256("DelegatedRevoke(address issuer,bytes32 didHash,uint64 deadline,uint256 nonce)");

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            block.chainid,
            address(this)
        ));
    }

    // ---------- Internal helpers ----------
    function _now() internal view returns (uint64) { return uint64(block.timestamp); }
    function _block() internal view returns (uint64) { return uint64(block.number); }

    function _upsert(address issuer, bytes32 didHash, bytes32 controllerAddress, uint64 expiresAt) internal {
        if (maxTTLSeconds != 0 && expiresAt != 0) {
            uint64 maxAllowed = _now() + maxTTLSeconds;
            if (expiresAt > maxAllowed) expiresAt = maxAllowed;
        }
        IOMA3DidOwnershipAttestationStore.Entry storage entry = _own[issuer][didHash];
        entry.active            = true;
        entry.recordedAt        = _now();
        entry.recordedBlock     = _block();
        entry.expiresAt         = expiresAt;
        entry.controllerAddress = controllerAddress;
        emit Upsert(issuer, didHash, controllerAddress, expiresAt, entry.recordedAt, entry.recordedBlock);
    }

    function _upsertData(address issuer, bytes32 didHash, bytes32 dataHash, uint64 expiresAt) internal {
        if (maxTTLSeconds != 0 && expiresAt != 0) {
            uint64 maxAllowed = _now() + maxTTLSeconds;
            if (expiresAt > maxAllowed) expiresAt = maxAllowed;
        }
        IOMA3DataUrlAttestationStore.DataEntry storage dataEntry = _data[issuer][didHash][dataHash];
        dataEntry.active        = true;
        dataEntry.recordedAt    = _now();
        dataEntry.recordedBlock = _block();
        dataEntry.expiresAt     = expiresAt;
        dataEntry.attester      = bytes32(uint256(uint160(issuer))); // Store attester address
    }

    function _revokeData(address issuer, bytes32 didHash, bytes32 dataHash) internal {
        IOMA3DataUrlAttestationStore.DataEntry storage dataEntry = _data[issuer][didHash][dataHash];
        dataEntry.active        = false;
        dataEntry.recordedAt    = _now();
        dataEntry.recordedBlock = _block();
    }

    function _revoke(address issuer, bytes32 didHash) internal {
        IOMA3DidOwnershipAttestationStore.Entry storage entry = _own[issuer][didHash];
        entry.active        = false;
        entry.recordedAt    = _now();
        entry.recordedBlock = _block();
        emit Revoke(issuer, didHash, entry.recordedAt, entry.recordedBlock);
    }

    function _verify(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }

    // ---------- IAttestationStore: writes ----------
    error ExpiredDeadline();
    error InvalidNonce();
    error BadSignature();

    function upsertDirect(bytes32 didHash, bytes32 controllerAddress, uint64 expiresAt) external override {
        _upsert(msg.sender, didHash, controllerAddress, expiresAt);
    }

    function revokeDirect(bytes32 didHash) external override {
        _revoke(msg.sender, didHash);
    }

    function upsertDelegated(Delegated calldata att, bytes calldata sig) external override {
        if (att.deadline < _now()) revert ExpiredDeadline();
        if (_nonceUsed[att.issuer][att.nonce]) revert InvalidNonce();

        bytes32 structHash = keccak256(abi.encode(
            DELEGATED_UPSERT_TYPEHASH,
            att.issuer, att.didHash, att.controllerAddress, att.expiresAt, att.deadline, att.nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _verify(digest, sig);
        if (recovered != att.issuer) revert BadSignature();

        _nonceUsed[att.issuer][att.nonce] = true;
        _upsert(att.issuer, att.didHash, att.controllerAddress, att.expiresAt);
    }

    // ---------- IDataUrlAttestationStore Implementation ----------

    function getDataEntry(address issuer, bytes32 didHash, bytes32 dataHash)
        external view returns (IOMA3DataUrlAttestationStore.DataEntry memory)
    {
        return _data[issuer][didHash][dataHash];
    }

    function attestDataHash(bytes32 didHash, bytes32 dataHash, uint64 expiresAt) external {
        require(isIssuer[msg.sender], "NOT_AUTHORIZED_ISSUER");
        _upsertData(msg.sender, didHash, dataHash, expiresAt);

        // Emit event
        emit IOMA3DataUrlAttestationStore.DataHashAttested(
            msg.sender, didHash, dataHash, expiresAt, _now(), _block()
        );
    }

    function revokeDataHash(bytes32 didHash, bytes32 dataHash) external {
        require(isIssuer[msg.sender], "NOT_AUTHORIZED_ISSUER");
        _revokeData(msg.sender, didHash, dataHash);

        // Emit event
        emit IOMA3DataUrlAttestationStore.DataHashRevoked(
            msg.sender, didHash, dataHash, _now(), _block()
        );
    }

    function revokeDelegated(
        address issuer,
        bytes32 didHash,
        uint64 deadline,
        uint256 nonce,
        bytes calldata sig
    ) external override {
        if (deadline < _now()) revert ExpiredDeadline();
        if (_nonceUsed[issuer][nonce]) revert InvalidNonce();

        bytes32 structHash = keccak256(abi.encode(
            DELEGATED_REVOKE_TYPEHASH,
            issuer, didHash, deadline, nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _verify(digest, sig);
        if (recovered != issuer) revert BadSignature();

        _nonceUsed[issuer][nonce] = true;
        _revoke(issuer, didHash);
    }

    // ---------- IAttestationStore: reads ----------
    function get(address issuer, bytes32 didHash) external view override returns (IOMA3DidOwnershipAttestationStore.Entry memory) {
        return _own[issuer][didHash];
    }

    function hasActive(address issuer, bytes32 didHash)
        external view override returns (bool ok, bytes32 controllerAddress, uint64 expiresAt)
    {
        IOMA3DidOwnershipAttestationStore.Entry storage entry = _own[issuer][didHash];
        bool alive = entry.active && (entry.expiresAt == 0 || _now() < entry.expiresAt);
        return (alive, entry.controllerAddress, entry.expiresAt);
    }

    // ---------- IResolver: ownership & data validation ----------

    function currentOwner(bytes32 didHash) external view returns (address) {
        // Dual-tally approach:
        // - Immediate tally (no maturation applied)
        // - Matured tally (maturation applied)
        // Selection:
        //   * No issuer entries           -> address(0)
        //   * No contention               -> immediate winner (effective immediately)
        //   * Contention (disagreement)   -> matured winner (or address(0) until matured consensus)

        uint256 issuerCount = 0;

        // Immediate (no maturation)
        address immediateWinner = address(0);
        bool immediateInitialized = false;
        bool immediateDisagree = false;

        // Matured (with maturation)
        address maturedWinner = address(0);
        bool maturedInitialized = false;
        bool maturedDisagree = false;

        for (uint256 i = 0; i < authorizedIssuers.length; i++) {
            address issuer = authorizedIssuers[i];
            IOMA3DidOwnershipAttestationStore.Entry storage entry = _own[issuer][didHash];
            if (!entry.active) continue;

            // Skip expired entries
            if (entry.expiresAt != 0 && _now() > entry.expiresAt) continue;

            issuerCount++;
            address ctrl = address(uint160(uint256(entry.controllerAddress)));

            // Immediate tally (no maturation)
            if (!immediateInitialized) {
                immediateInitialized = true;
                immediateWinner = ctrl;
            } else if (ctrl != immediateWinner) {
                immediateDisagree = true;
            }

            // Matured tally (apply maturation window)
            bool maturedOk = (maturationSeconds == 0) || (_now() >= entry.recordedAt + maturationSeconds);
            if (maturedOk) {
                if (!maturedInitialized) {
                    maturedInitialized = true;
                    maturedWinner = ctrl;
                } else if (ctrl != maturedWinner) {
                    maturedDisagree = true;
                }
            }
        }

        if (issuerCount == 0) {
            return address(0);
        }

        // Contention exists if multiple issuers and they disagree on controller (without maturation)
        bool contention = (issuerCount > 1) && immediateDisagree;
        if (!contention) {
            // Single issuer or multiple issuers in agreement -> effective immediately
            return immediateWinner;
        }

        // Contested: require matured consensus (may be unset until maturation elapses)
        if (maturedInitialized && !maturedDisagree) {
            return maturedWinner;
        }

        return address(0);
    }

    function checkDataHashAttestation(bytes32 didHash, bytes32 dataHash) external view override(IOMA3DataUrlAttestationStore, IOMA3DataUrlResolver) returns (bool) {
        // Check if any allowlisted issuer has attested to this data hash for this DID
        for (uint256 i = 0; i < authorizedIssuers.length; i++) {
            address issuer = authorizedIssuers[i];

            IOMA3DataUrlAttestationStore.DataEntry storage entry = _data[issuer][didHash][dataHash];
            if (!entry.active) continue;

            // Check if expired
            if (entry.expiresAt != 0 && _now() > entry.expiresAt) continue;

            return true; // Found valid attestation
        }

        return false;
    }

    // ---------- Events ----------
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);
    event RegistrationParamsPrepared(address indexed who, string didString, uint64 expiresAt);
    event RegistrationParamsConsumed(address indexed who, string didString);

    // ---------- Admin: set policy ----------
    function addAuthorizedIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid issuer address");
        require(!isIssuer[issuer], "Issuer already authorized");
        isIssuer[issuer] = true;
        authorizedIssuers.push(issuer);
        emit IssuerAuthorized(issuer);
    }
    
    function removeAuthorizedIssuer(address issuer) external onlyOwner {
        require(isIssuer[issuer], "Issuer not authorized");
        isIssuer[issuer] = false;
        
        // Remove from array (swap with last and pop)
        for (uint256 i = 0; i < authorizedIssuers.length; i++) {
            if (authorizedIssuers[i] == issuer) {
                authorizedIssuers[i] = authorizedIssuers[authorizedIssuers.length - 1];
                authorizedIssuers.pop();
                break;
            }
        }
        
        emit IssuerRevoked(issuer);
    }
    
    function setMaturation(uint64 durationSeconds) external onlyOwner {
        maturationSeconds = durationSeconds;
    }
    
    function setMaxTTL(uint64 durationSeconds) external onlyOwner {
        maxTTLSeconds = durationSeconds;
    }

    // ---------- Registration Stored Params Functions (ERC-8004 Support) ----------
    
    /**
     * @notice Prepare registration parameters for tokenURI-only registration
     * @dev Stores all required registration data keyed by msg.sender
     * @param didString The DID string
     * @param interfaces Interface bitmap
     * @param tokenURI The expected tokenURI for validation
     * @param dataHash Hash of the metadata
     * @param dataHashAlgorithm Algorithm used for hashing (0=keccak256, 1=sha256)
     * @param fungibleTokenId CAIP-19 token ID (optional)
     * @param contractId CAIP-10 contract address (optional)
     * @param initialVersionMajor Major version number
     * @param initialVersionMinor Minor version number
     * @param initialVersionPatch Patch version number
     * @param traitHashes Array of trait hashes
     * @param metadataJson Optional JSON metadata to store on-chain
     * @param expiresAt Unix timestamp when these params expire (0 = no expiry)
     */
    function prepareRegister(
        string memory didString,
        uint16 interfaces,
        string memory tokenURI,
        bytes32 dataHash,
        uint8 dataHashAlgorithm,
        string memory fungibleTokenId,
        string memory contractId,
        uint8 initialVersionMajor,
        uint8 initialVersionMinor,
        uint8 initialVersionPatch,
        bytes32[] memory traitHashes,
        string memory metadataJson,
        uint64 expiresAt
    ) external {
        _registrationStoredParams[msg.sender] = RegistrationStoredParams({
            didString: didString,
            interfaces: interfaces,
            tokenURI: tokenURI,
            dataHash: dataHash,
            dataHashAlgorithm: dataHashAlgorithm,
            fungibleTokenId: fungibleTokenId,
            contractId: contractId,
            initialVersionMajor: initialVersionMajor,
            initialVersionMinor: initialVersionMinor,
            initialVersionPatch: initialVersionPatch,
            traitHashes: traitHashes,
            metadataJson: metadataJson,
            expiresAt: expiresAt,
            exists: true
        });
        
        emit RegistrationParamsPrepared(msg.sender, didString, expiresAt);
    }
    
    /**
     * @notice Load and consume stored registration parameters (registry only)
     * @dev Returns the params and deletes them atomically. Validates tokenURI matches.
     * @param who The address that prepared the params
     * @param expectedTokenURI The tokenURI being used for registration (must match stored params)
     * @return storedParams The stored registration parameters
     */
    function loadAndConsumeRegister(address who, string memory expectedTokenURI) external returns (RegistrationStoredParams memory storedParams) {
        storedParams = _registrationStoredParams[who];
        require(storedParams.exists, "NO_STORED_PARAMS");
        
        // Check expiry
        if (storedParams.expiresAt != 0) {
            require(_now() <= storedParams.expiresAt, "PARAMS_EXPIRED");
        }
        
        // Validate tokenURI matches (security: prevent params hijacking)
        require(
            keccak256(bytes(storedParams.tokenURI)) == keccak256(bytes(expectedTokenURI)),
            "TOKEN_URI_MISMATCH"
        );
        
        // Delete the params (consume once)
        delete _registrationStoredParams[who];
        
        emit RegistrationParamsConsumed(who, storedParams.didString);
        
        return storedParams;
    }
}
