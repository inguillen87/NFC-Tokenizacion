import { aes128CbcDecrypt, aes128CbcEncrypt, aesCmac, bufToHex, hexToBuf, truncateMac8 } from "./aes";

type NodeBuf = Buffer<ArrayBufferLike>;

export type SunVerifyResult =
  | { ok: true; uidHex: string; ctr: number; encPlainHex?: string }
  | { ok: false; reason: string };

export function verifySun(params: {
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  kMetaHex: string;
  kFileHex: string;
}): SunVerifyResult {
  const zeroIV = Buffer.alloc(16, 0x00) as NodeBuf;
  const piccEnc = hexToBuf(params.piccDataHex);
  const enc = hexToBuf(params.encHex);

  const kMeta = Buffer.from(params.kMetaHex, "hex") as NodeBuf;
  const kFile = Buffer.from(params.kFileHex, "hex") as NodeBuf;

  if (piccEnc.length % 16 !== 0) return { ok: false, reason: "picc_data bad length" };
  const picc = aes128CbcDecrypt(kMeta, zeroIV, piccEnc);

  const tag = picc[0]!;
  const uidLen = tag & 0x0f;
  if (uidLen < 4 || uidLen > 10) return { ok: false, reason: "uid length invalid" };

  const uid = picc.subarray(1, 1 + uidLen) as NodeBuf;
  const ctrBytes = picc.subarray(1 + uidLen, 1 + uidLen + 3) as NodeBuf;
  const ctr = ctrBytes[0]! + (ctrBytes[1]! << 8) + (ctrBytes[2]! << 16);

  const sv1 = Buffer.concat([Buffer.from("C33C00010080", "hex"), uid, ctrBytes]) as NodeBuf;
  const sv2 = Buffer.concat([Buffer.from("3CC300010080", "hex"), uid, ctrBytes]) as NodeBuf;
  const kSesEnc = aesCmac(kFile, sv1);
  const kSesMac = aesCmac(kFile, sv2);

  const msg = Buffer.from(params.encHex.toUpperCase() + "&cmac=", "ascii") as NodeBuf;
  const full = aesCmac(kSesMac, msg);
  const expected = truncateMac8(full);

  if (expected.toString("hex").toUpperCase() !== params.cmacHex.toUpperCase()) {
    return { ok: false, reason: "cmac mismatch" };
  }

  let encPlainHex: string | undefined;
  if (enc.length % 16 === 0) {
    const iveInput = Buffer.concat([ctrBytes, Buffer.alloc(13, 0x00)]) as NodeBuf;
    const ive = aes128CbcEncrypt(kSesEnc, zeroIV, iveInput);
    const encPlain = aes128CbcDecrypt(kSesEnc, ive, enc);
    encPlainHex = bufToHex(encPlain);
  }

  return { ok: true, uidHex: bufToHex(uid), ctr, encPlainHex };
}
