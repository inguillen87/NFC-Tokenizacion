import { createCipheriv, createDecipheriv } from "crypto";

export function hexToBuf(hex: string): Buffer {
  if (hex.length % 2 !== 0) throw new Error("hex length must be even");
  return Buffer.from(hex, "hex");
}

export function bufToHex(buf: Buffer): string {
  return buf.toString("hex").toUpperCase();
}

export function aes128CbcDecrypt(key: Buffer, iv: Buffer, ciphertext: Buffer): Buffer {
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function aes128CbcEncrypt(key: Buffer, iv: Buffer, plaintext: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

export function aes128EcbEncrypt(key: Buffer, block16: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block16), cipher.final()]);
}

export function aesCmac(key: Buffer, message: Buffer): Buffer {
  if (key.length !== 16) throw new Error("CMAC key must be 16 bytes");
  const blockSize = 16;
  const zero = Buffer.alloc(blockSize, 0x00);
  const L = aes128EcbEncrypt(key, zero);
  const K1 = generateSubkey(L);
  const K2 = generateSubkey(K1);

  const n = Math.max(1, Math.ceil(message.length / blockSize));
  const lastBlockComplete = message.length !== 0 && message.length % blockSize === 0;

  const blocks: Buffer[] = [];
  for (let i = 0; i < n - 1; i++) {
    blocks.push(message.subarray(i * blockSize, (i + 1) * blockSize));
  }

  let last = message.subarray((n - 1) * blockSize);
  last = lastBlockComplete ? xor(last, K1) : xor(pad(last, blockSize), K2);

  let X = Buffer.alloc(blockSize, 0x00);
  for (const b of blocks) {
    X = aes128EcbEncrypt(key, xor(X, b));
  }
  return aes128EcbEncrypt(key, xor(X, last));
}

export function truncateMac8(fullCmac16: Buffer): Buffer {
  const out = Buffer.alloc(8);
  let j = 0;
  for (let i = 1; i < 16; i += 2) out[j++] = fullCmac16[i];
  return out;
}

function pad(m: Buffer, blockSize: number): Buffer {
  const out = Buffer.alloc(blockSize, 0x00);
  m.copy(out, 0);
  out[m.length] = 0x80;
  return out;
}

function xor(a: Buffer, b: Buffer): Buffer {
  if (a.length !== b.length) throw new Error("xor length mismatch");
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function leftShiftOneBit(input: Buffer): Buffer {
  const out = Buffer.alloc(input.length);
  let carry = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const v = input[i];
    out[i] = ((v << 1) & 0xff) | carry;
    carry = (v & 0x80) ? 1 : 0;
  }
  return out;
}

function generateSubkey(L: Buffer): Buffer {
  const Rb = Buffer.from("00000000000000000000000000000087", "hex");
  const msbSet = (L[0] & 0x80) !== 0;
  let K = leftShiftOneBit(L);
  if (msbSet) K = xor(K, Rb);
  return K;
}
