import { createCipheriv, createDecipheriv } from "crypto";

type NodeBuf = Buffer<ArrayBufferLike>;

function asBuf(input: Uint8Array | NodeBuf): NodeBuf {
  return Buffer.from(input) as NodeBuf;
}

export function hexToBuf(hex: string): NodeBuf {
  if (hex.length % 2 !== 0) throw new Error("hex length must be even");
  return Buffer.from(hex, "hex") as NodeBuf;
}

export function bufToHex(buf: Uint8Array): string {
  return Buffer.from(buf).toString("hex").toUpperCase();
}

export function aes128CbcDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): NodeBuf {
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]) as NodeBuf;
}

export function aes128CbcEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): NodeBuf {
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]) as NodeBuf;
}

export function aes128EcbEncrypt(key: Uint8Array, block16: Uint8Array): NodeBuf {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block16), cipher.final()]) as NodeBuf;
}

export function aesCmac(key: Uint8Array, message: Uint8Array): NodeBuf {
  if (key.length !== 16) throw new Error("CMAC key must be 16 bytes");
  const blockSize = 16;
  const zero = Buffer.alloc(blockSize, 0x00) as NodeBuf;
  const L = aes128EcbEncrypt(key, zero);
  const K1 = generateSubkey(L);
  const K2 = generateSubkey(K1);

  const n = Math.max(1, Math.ceil(message.length / blockSize));
  const lastBlockComplete = message.length !== 0 && message.length % blockSize === 0;

  const blocks: NodeBuf[] = [];
  for (let i = 0; i < n - 1; i++) {
    blocks.push(asBuf(message.subarray(i * blockSize, (i + 1) * blockSize)));
  }

  let last = asBuf(message.subarray((n - 1) * blockSize));
  last = lastBlockComplete ? xor(last, K1) : xor(pad(last, blockSize), K2);

  let X: NodeBuf = Buffer.alloc(blockSize, 0x00) as NodeBuf;
  for (const b of blocks) {
    X = aes128EcbEncrypt(key, xor(X, b));
  }
  return aes128EcbEncrypt(key, xor(X, last));
}

export function truncateMac8(fullCmac16: Uint8Array): NodeBuf {
  const out = Buffer.alloc(8) as NodeBuf;
  let j = 0;
  for (let i = 1; i < 16; i += 2) out[j++] = fullCmac16[i];
  return out;
}

function pad(m: Uint8Array, blockSize: number): NodeBuf {
  const out = Buffer.alloc(blockSize, 0x00) as NodeBuf;
  Buffer.from(m).copy(out, 0);
  out[m.length] = 0x80;
  return out;
}

function xor(a: Uint8Array, b: Uint8Array): NodeBuf {
  if (a.length !== b.length) throw new Error("xor length mismatch");
  const out = Buffer.alloc(a.length) as NodeBuf;
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function leftShiftOneBit(input: Uint8Array): NodeBuf {
  const out = Buffer.alloc(input.length) as NodeBuf;
  let carry = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const v = input[i]!;
    out[i] = ((v << 1) & 0xff) | carry;
    carry = (v & 0x80) ? 1 : 0;
  }
  return out;
}

function generateSubkey(L: Uint8Array): NodeBuf {
  const Rb = Buffer.from("00000000000000000000000000000087", "hex") as NodeBuf;
  const msbSet = (L[0]! & 0x80) !== 0;
  let K = leftShiftOneBit(L);
  if (msbSet) K = xor(K, Rb);
  return K;
}
