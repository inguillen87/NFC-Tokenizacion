// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LogisticsEventAnchor {
    event RootAnchored(
        bytes32 indexed merkleRoot,
        string indexed tenantIdHash,
        string resourceType,
        string resourceId,
        uint256 eventCount,
        uint256 anchoredAt
    );

    function anchorRoot(
        bytes32 merkleRoot,
        string calldata tenantIdHash,
        string calldata resourceType,
        string calldata resourceId,
        uint256 eventCount
    ) external {
        emit RootAnchored(
            merkleRoot,
            tenantIdHash,
            resourceType,
            resourceId,
            eventCount,
            block.timestamp
        );
    }
}
