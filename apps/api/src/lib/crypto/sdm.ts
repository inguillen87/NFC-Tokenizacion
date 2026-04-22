import { aes128CbcDecrypt, aes128CbcEncrypt, aesCmac, bufToHex, hexToBuf, truncateMac8 } from "./aes";

type NodeBuf = Buffer<ArrayBufferLike>;

export type SunVerifyResult =
  | { ok: true; uidHex: string; ctr: number; encPlainHex?: string; piccPlainHex?: string }
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

  return { ok: true, uidHex: bufToHex(uid), ctr, encPlainHex, piccPlainHex: bufToHex(picc) };
}


export function generateSunParams(params: {
  uidHex: string;
  ctr: number;
  kMetaHex: string;
  kFileHex: string;
  encPlainHex?: string;
}) {
  const zeroIV = Buffer.alloc(16, 0x00) as NodeBuf;
  const uid = Buffer.from(params.uidHex, 'hex') as NodeBuf;
  const uidLen = uid.length;
  if (uidLen < 4 || uidLen > 10) throw new Error('uid length invalid');

  const ctrBytes = Buffer.from([
    params.ctr & 0xff,
    (params.ctr >> 8) & 0xff,
    (params.ctr >> 16) & 0xff,
  ]) as NodeBuf;

  const piccPlain = Buffer.alloc(16, 0x00) as NodeBuf;
  piccPlain[0] = 0x80 | uidLen;
  uid.copy(piccPlain, 1);
  ctrBytes.copy(piccPlain, 1 + uidLen);

  const kMeta = Buffer.from(params.kMetaHex, 'hex') as NodeBuf;
  const kFile = Buffer.from(params.kFileHex, 'hex') as NodeBuf;
  const piccData = aes128CbcEncrypt(kMeta, zeroIV, piccPlain);

  const sv1 = Buffer.concat([Buffer.from('C33C00010080', 'hex'), uid, ctrBytes]) as NodeBuf;
  const sv2 = Buffer.concat([Buffer.from('3CC300010080', 'hex'), uid, ctrBytes]) as NodeBuf;
  const kSesEnc = aesCmac(kFile, sv1);
  const kSesMac = aesCmac(kFile, sv2);

  const encPlain = Buffer.from(params.encPlainHex || '00000000000000000000000000000000', 'hex') as NodeBuf;
  const iveInput = Buffer.concat([ctrBytes, Buffer.alloc(13, 0x00)]) as NodeBuf;
  const ive = aes128CbcEncrypt(kSesEnc, zeroIV, iveInput);
  const enc = aes128CbcEncrypt(kSesEnc, ive, encPlain);

  const msg = Buffer.from(bufToHex(enc).toUpperCase() + '&cmac=', 'ascii') as NodeBuf;
  const cmac = truncateMac8(aesCmac(kSesMac, msg));

  return {
    piccDataHex: bufToHex(piccData).toUpperCase(),
    encHex: bufToHex(enc).toUpperCase(),
    cmacHex: bufToHex(cmac).toUpperCase(),
  };
}
