# IOTA Proof Layer

To prove the authenticity of logistics and telemetry data without incurring massive gas fees on EVM chains, we anchor evidence to the IOTA Tangle.

## Mechanism
- **Feelless Transactions:** Devices and gateways push event payloads (e.g. "Temperature Excursion at 25C") to IOTA.
- **Data Anchoring:** Event hashes are bundled and published using IOTA's Stardust framework or specialized EVM L2 anchored on IOTA.
- **Trustless Auditing:** Third-party auditors can query the Tangle to verify that an event payload matches the recorded hash and timestamp.

## Smart Contract Integration
- `LogisticsEventAnchor.sol`: Exists on the IOTA EVM chain to manage the anchoring of event hashes.
