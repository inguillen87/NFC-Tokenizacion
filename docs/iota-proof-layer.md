# IOTA proof layer

IOTA es la capa de evidencia publica hash-only de nexID. No guarda la operacion privada: publica recibos minimos que permiten comprobar que un conjunto de eventos existia y no fue alterado.

La demo actual usa **IOTA EVM Testnet (chain ID 1076)**. Es una red de prueba: las transacciones consumen gas testnet, pueden perderse si la red se reinicia y no constituyen evidencia legal de produccion. nexID no afirma que IOTA sea gratis ni que exista una partnership oficial.

## Que se publica

`NexidEvidenceAnchor` V2 registra:

- Merkle root del conjunto de eventos.
- Hash del tenant, nunca su identificador privado.
- Tipo e identificador publico del recurso demo.
- Cantidad de eventos incluidos.
- Hash del memo ejecutivo.
- Publisher, bloque y timestamp de red.

No se publican UID NFC, claves, pacientes, compradores, manifiestos, rutas completas, contratos ni documentos QA.

## Flujo verificable

1. nexID normaliza eventos privados y calcula hashes SHA-256.
2. Los hashes forman un Merkle root reproducible.
3. Un publisher autorizado envia el root y metadata minima al contrato V2.
4. El contrato deriva un `proofId`, evita duplicados y emite `EvidenceAnchored`.
5. La API recupera transaccion, receipt y calldata desde RPC.
6. Proof Verifier decodifica esos campos y los traduce a lenguaje de negocio.

Un explorer muestra hexadecimal porque esa es la representacion nativa de la transaccion. El decoder de nexID no inventa contenido: interpreta el calldata de esa misma transaccion y comprueba contrato, publisher, chain, receipt, root y memo hash.

## Fixture publico real

- Contrato V2: `0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`
- Publisher demo: `0x2f320d2B0D8AE483637D8f5509480228509165cB`
- Secure Delivery: `0xdb59a61427fd9ffef0e9c1112fed76ea71053cffab684fc6888a00abf748d8a8`
- Pharma Cold Chain: `0x4b33d013d81596aea6bc7611400fe7a77fcc1dc98a1d190aa21cb4a38036c079`
- Agro Stewardship: `0x1af34ec919d14ef46cd14723d00d4d2eabe3699d0dbe4d1533b2dc1ef0e205d0`

Superficies publicas:

- Verificador legible: `https://nexid.lat/proof/verify`
- Catalogo y verificacion RPC: `https://api.nexid.lat/public/proof/demo-cases`
- Contrato en explorer: `https://explorer.evm.testnet.iota.cafe/address/0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0`
- Verificador operativo: `npm run iota:verify-proof-v2 --workspace=api`

## Escritura y produccion

La API de produccion puede verificar en modo read-only sin alojar una clave IOTA. Para publicar anchors nuevos, el signer debe vivir en un executor aislado con KMS/HSM o custodia enterprise, allowlist de tenants, rate limits, auditoria y monitoreo de nonce/gas.

Antes de pasar a mainnet se requiere desplegar un contrato nuevo controlado por roles de produccion, verificar su source, rotar wallets demo y definir retencion, SLA, jurisdiccion y politica de evidencia con cada cliente.
