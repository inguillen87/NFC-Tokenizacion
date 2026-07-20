// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NexidEvidenceAnchor
 * @notice Publishes privacy-preserving evidence receipts for authorized nexID tenants.
 * @dev Only hashes and non-sensitive public references belong on-chain.
 */
contract NexidEvidenceAnchor is Ownable {
    error ZeroAddress();
    error UnauthorizedPublisher();
    error EmptyMerkleRoot();
    error EmptyTenantIdHash();
    error EmptyMemoHash();
    error InvalidEventCount();
    error ResourceTypeTooLong();
    error ResourceIdTooLong();
    error EvidenceAlreadyAnchored(bytes32 proofId);

    uint16 public constant SCHEMA_VERSION = 2;
    uint256 public constant MAX_RESOURCE_TYPE_BYTES = 64;
    uint256 public constant MAX_RESOURCE_ID_BYTES = 128;
    bytes32 public constant PROOF_DOMAIN = keccak256("nexid.evidence.anchor.v2");

    struct EvidenceRecord {
        bytes32 merkleRoot;
        bytes32 tenantIdHash;
        bytes32 memoHash;
        address publisher;
        uint64 eventCount;
        uint64 anchoredAt;
    }

    mapping(address => bool) public authorizedPublishers;
    mapping(bytes32 => EvidenceRecord) private _evidenceByProofId;

    event PublisherUpdated(address indexed publisher, bool enabled);
    event EvidenceAnchored(
        bytes32 indexed proofId,
        bytes32 indexed merkleRoot,
        bytes32 indexed tenantIdHash,
        string resourceType,
        string resourceId,
        uint64 eventCount,
        bytes32 memoHash,
        address publisher,
        uint64 anchoredAt,
        uint16 schemaVersion
    );

    constructor(address initialOwner, address initialPublisher) Ownable(initialOwner) {
        if (initialOwner == address(0) || initialPublisher == address(0)) revert ZeroAddress();
        authorizedPublishers[initialPublisher] = true;
        emit PublisherUpdated(initialPublisher, true);
    }

    modifier onlyPublisher() {
        if (!authorizedPublishers[msg.sender]) revert UnauthorizedPublisher();
        _;
    }

    function setPublisher(address publisher, bool enabled) external onlyOwner {
        if (publisher == address(0)) revert ZeroAddress();
        authorizedPublishers[publisher] = enabled;
        emit PublisherUpdated(publisher, enabled);
    }

    function computeProofId(
        bytes32 merkleRoot,
        bytes32 tenantIdHash,
        string calldata resourceType,
        string calldata resourceId,
        uint64 eventCount,
        bytes32 memoHash
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                PROOF_DOMAIN,
                block.chainid,
                address(this),
                merkleRoot,
                tenantIdHash,
                keccak256(bytes(resourceType)),
                keccak256(bytes(resourceId)),
                eventCount,
                memoHash
            )
        );
    }

    function anchorEvidence(
        bytes32 merkleRoot,
        bytes32 tenantIdHash,
        string calldata resourceType,
        string calldata resourceId,
        uint64 eventCount,
        bytes32 memoHash
    ) external onlyPublisher returns (bytes32 proofId) {
        if (merkleRoot == bytes32(0)) revert EmptyMerkleRoot();
        if (tenantIdHash == bytes32(0)) revert EmptyTenantIdHash();
        if (memoHash == bytes32(0)) revert EmptyMemoHash();
        if (eventCount == 0) revert InvalidEventCount();
        if (bytes(resourceType).length == 0 || bytes(resourceType).length > MAX_RESOURCE_TYPE_BYTES) {
            revert ResourceTypeTooLong();
        }
        if (bytes(resourceId).length == 0 || bytes(resourceId).length > MAX_RESOURCE_ID_BYTES) {
            revert ResourceIdTooLong();
        }

        proofId = computeProofId(
            merkleRoot,
            tenantIdHash,
            resourceType,
            resourceId,
            eventCount,
            memoHash
        );
        if (_evidenceByProofId[proofId].anchoredAt != 0) revert EvidenceAlreadyAnchored(proofId);

        uint64 anchoredAt = uint64(block.timestamp);
        _evidenceByProofId[proofId] = EvidenceRecord({
            merkleRoot: merkleRoot,
            tenantIdHash: tenantIdHash,
            memoHash: memoHash,
            publisher: msg.sender,
            eventCount: eventCount,
            anchoredAt: anchoredAt
        });

        emit EvidenceAnchored(
            proofId,
            merkleRoot,
            tenantIdHash,
            resourceType,
            resourceId,
            eventCount,
            memoHash,
            msg.sender,
            anchoredAt,
            SCHEMA_VERSION
        );
    }

    function isAnchored(bytes32 proofId) external view returns (bool) {
        return _evidenceByProofId[proofId].anchoredAt != 0;
    }

    function evidenceRecord(bytes32 proofId) external view returns (EvidenceRecord memory) {
        return _evidenceByProofId[proofId];
    }
}
