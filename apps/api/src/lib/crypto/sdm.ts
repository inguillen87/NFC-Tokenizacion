import { aes128CbcDecrypt, aes128CbcEncrypt, aesCmac, bufToHex, hexToBuf, truncateMac8 } from "./aes";

type NodeBuf = Buffer<ArrayBufferLike>;

export const DEFAULT_SUN_MAC_INPUT_MODE = "enc_plus_cmac_literal";

export const SUN_MAC_INPUT_MODES = [
  DEFAULT_SUN_MAC_INPUT_MODE,
  "enc_only_ascii",
  "query_from_enc_to_cmac",
  "query_from_picc_data_to_cmac",
] as const;

export type SunMacInputMode = (typeof SUN_MAC_INPUT_MODES)[number];

export type SunPiccCandidateDiagnostic = {
  layout: string;
  uidHex: string;
  ctr: number;
  uidOffset: number;
  uidLength: number;
  counterOffset: number;
};

export type SunCmacCandidateDiagnostic = {
  name: SunMacInputMode;
  inputPrefix: string;
  expectedCmacHex: string;
  actualCmacHex: string;
  match: boolean;
  uidHex: string;
  ctr: number;
  piccLayout: string;
};

export type SunVerifyResult =
  | {
      ok: true;
      uidHex: string;
      ctr: number;
      encPlainHex?: string;
      piccPlainHex?: string;
      cmacValid: boolean;
      sdmDecryptionOk: boolean;
      uidDecoded: boolean;
      expectedCmacHex: string;
      actualCmacHex: string;
      piccLayout: string;
      macInputMode: SunMacInputMode;
      piccCandidates: SunPiccCandidateDiagnostic[];
      cmacCandidates: SunCmacCandidateDiagnostic[];
    }
  | {
      ok: false;
      reason: string;
      uidHex?: string | null;
      ctr?: number | null;
      encPlainHex?: string;
      piccPlainHex?: string;
      cmacValid?: boolean;
      sdmDecryptionOk?: boolean;
      uidDecoded?: boolean;
      expectedCmacHex?: string;
      actualCmacHex?: string;
      piccLayout?: string | null;
      macInputMode?: SunMacInputMode | null;
      piccCandidates?: SunPiccCandidateDiagnostic[];
      cmacCandidates?: SunCmacCandidateDiagnostic[];
    };

function readLittleEndian24(bytes: NodeBuf) {
  return bytes[0]! + (bytes[1]! << 8) + (bytes[2]! << 16);
}

function normalizeMacInputModes(input: unknown): SunMacInputMode[] {
  const raw = Array.isArray(input) ? input : [input || DEFAULT_SUN_MAC_INPUT_MODE];
  const supported = new Set<string>(SUN_MAC_INPUT_MODES);
  const modes: SunMacInputMode[] = [];
  for (const value of raw) {
    const mode = String(value || "").trim();
    if (supported.has(mode) && !modes.includes(mode as SunMacInputMode)) modes.push(mode as SunMacInputMode);
  }
  return modes.length ? modes : [DEFAULT_SUN_MAC_INPUT_MODE];
}

function buildMacInput(mode: SunMacInputMode, piccDataHex: string, encHex: string) {
  const piccUpper = piccDataHex.toUpperCase();
  const encUpper = encHex.toUpperCase();
  switch (mode) {
    case "enc_only_ascii":
      return Buffer.from(encUpper, "ascii") as NodeBuf;
    case "query_from_enc_to_cmac":
      return Buffer.from(`enc=${encUpper}&cmac=`, "ascii") as NodeBuf;
    case "query_from_picc_data_to_cmac":
      return Buffer.from(`picc_data=${piccUpper}&enc=${encUpper}&cmac=`, "ascii") as NodeBuf;
    case "enc_plus_cmac_literal":
    default:
      return Buffer.from(`${encUpper}&cmac=`, "ascii") as NodeBuf;
  }
}

function pushPiccCandidate(
  candidates: SunPiccCandidateDiagnostic[],
  picc: NodeBuf,
  layout: string,
  uidOffset: number,
  uidLength: number,
  counterOffset: number,
) {
  if (uidLength < 4 || uidLength > 10) return;
  if (uidOffset < 0 || counterOffset < 0) return;
  if (picc.length < uidOffset + uidLength || picc.length < counterOffset + 3) return;
  const uid = picc.subarray(uidOffset, uidOffset + uidLength) as NodeBuf;
  const ctrBytes = picc.subarray(counterOffset, counterOffset + 3) as NodeBuf;
  const uidHex = bufToHex(uid);
  const ctr = readLittleEndian24(ctrBytes);
  const duplicate = candidates.some(
    (candidate) => candidate.uidHex === uidHex && candidate.ctr === ctr && candidate.counterOffset === counterOffset,
  );
  if (duplicate) return;
  candidates.push({ layout, uidHex, ctr, uidOffset, uidLength, counterOffset });
}

function extractPiccCandidates(picc: NodeBuf): SunPiccCandidateDiagnostic[] {
  const candidates: SunPiccCandidateDiagnostic[] = [];
  const legacyUidLen = (picc[0] ?? 0) & 0x0f;
  pushPiccCandidate(candidates, picc, "legacy_len_nibble_uid_ctr", 1, legacyUidLen, 1 + legacyUidLen);

  // Some supplier ChangeFileSet profiles expose a fixed 7-byte UID without the
  // legacy length nibble. Keep this as a diagnostic candidate; authenticity is
  // still decided only when the configured CMAC input also matches.
  const maxOffset = Math.min(6, Math.max(0, picc.length - 10));
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    pushPiccCandidate(candidates, picc, `uid7_ctr3_offset_${offset}`, offset, 7, offset + 7);
  }

  return candidates;
}

function deriveSessionKeys(kFile: NodeBuf, uidHex: string, ctr: number) {
  const uid = Buffer.from(uidHex, "hex") as NodeBuf;
  const ctrBytes = Buffer.from([ctr & 0xff, (ctr >> 8) & 0xff, (ctr >> 16) & 0xff]) as NodeBuf;
  const sv1 = Buffer.concat([Buffer.from("C33C00010080", "hex"), uid, ctrBytes]) as NodeBuf;
  const sv2 = Buffer.concat([Buffer.from("3CC300010080", "hex"), uid, ctrBytes]) as NodeBuf;
  return {
    ctrBytes,
    kSesEnc: aesCmac(kFile, sv1),
    kSesMac: aesCmac(kFile, sv2),
  };
}

export function verifySun(params: {
  piccDataHex: string;
  encHex: string;
  cmacHex: string;
  kMetaHex: string;
  kFileHex: string;
  macInputModes?: unknown;
}): SunVerifyResult {
  const zeroIV = Buffer.alloc(16, 0x00) as NodeBuf;
  let piccEnc: NodeBuf;
  let enc: NodeBuf;
  try {
    piccEnc = hexToBuf(params.piccDataHex);
    enc = hexToBuf(params.encHex);
  } catch {
    return { ok: false, reason: "invalid hex payload", uidDecoded: false, cmacValid: false, sdmDecryptionOk: false };
  }

  const kMeta = Buffer.from(params.kMetaHex, "hex") as NodeBuf;
  const kFile = Buffer.from(params.kFileHex, "hex") as NodeBuf;

  if (piccEnc.length % 16 !== 0) {
    return { ok: false, reason: "picc_data bad length", uidDecoded: false, cmacValid: false, sdmDecryptionOk: false };
  }
  let picc: NodeBuf;
  try {
    picc = aes128CbcDecrypt(kMeta, zeroIV, piccEnc);
  } catch {
    return { ok: false, reason: "picc_data decrypt failed", uidDecoded: false, cmacValid: false, sdmDecryptionOk: false };
  }
  const piccPlainHex = bufToHex(picc);
  const piccCandidates = extractPiccCandidates(picc);
  const actualCmacHex = params.cmacHex.toUpperCase();

  if (!piccCandidates.length) {
    return {
      ok: false,
      reason: "uid length invalid",
      piccPlainHex,
      uidDecoded: false,
      cmacValid: false,
      sdmDecryptionOk: false,
      actualCmacHex,
      piccCandidates,
      cmacCandidates: [],
    };
  }

  const modes = normalizeMacInputModes(params.macInputModes);
  const cmacCandidates: SunCmacCandidateDiagnostic[] = [];

  for (const piccCandidate of piccCandidates) {
    const { ctrBytes, kSesEnc, kSesMac } = deriveSessionKeys(kFile, piccCandidate.uidHex, piccCandidate.ctr);
    for (const mode of modes) {
      const msg = buildMacInput(mode, params.piccDataHex, params.encHex);
      const expected = truncateMac8(aesCmac(kSesMac, msg));
      const expectedCmacHex = expected.toString("hex").toUpperCase();
      const candidate: SunCmacCandidateDiagnostic = {
        name: mode,
        inputPrefix: msg.toString("ascii").slice(0, 96),
        expectedCmacHex,
        actualCmacHex,
        match: expectedCmacHex === actualCmacHex,
        uidHex: piccCandidate.uidHex,
        ctr: piccCandidate.ctr,
        piccLayout: piccCandidate.layout,
      };
      cmacCandidates.push(candidate);

      if (!candidate.match) continue;

      if (enc.length % 16 !== 0) {
        return {
          ok: false,
          reason: "enc bad length",
          uidHex: piccCandidate.uidHex,
          ctr: piccCandidate.ctr,
          piccPlainHex,
          uidDecoded: true,
          cmacValid: true,
          sdmDecryptionOk: false,
          expectedCmacHex,
          actualCmacHex,
          piccLayout: piccCandidate.layout,
          macInputMode: mode,
          piccCandidates,
          cmacCandidates,
        };
      }

      const iveInput = Buffer.concat([ctrBytes, Buffer.alloc(13, 0x00)]) as NodeBuf;
      const ive = aes128CbcEncrypt(kSesEnc, zeroIV, iveInput);
      const encPlain = aes128CbcDecrypt(kSesEnc, ive, enc);
      const encPlainHex = bufToHex(encPlain);

      return {
        ok: true,
        uidHex: piccCandidate.uidHex,
        ctr: piccCandidate.ctr,
        encPlainHex,
        piccPlainHex,
        cmacValid: true,
        sdmDecryptionOk: true,
        uidDecoded: true,
        expectedCmacHex,
        actualCmacHex,
        piccLayout: piccCandidate.layout,
        macInputMode: mode,
        piccCandidates,
        cmacCandidates,
      };
    }
  }

  const firstPicc = piccCandidates[0]!;
  const firstCmac = cmacCandidates[0];
  return {
    ok: false,
    reason: "cmac mismatch",
    uidHex: firstPicc.uidHex,
    ctr: firstPicc.ctr,
    piccPlainHex,
    uidDecoded: true,
    cmacValid: false,
    sdmDecryptionOk: false,
    expectedCmacHex: firstCmac?.expectedCmacHex,
    actualCmacHex,
    piccLayout: firstPicc.layout,
    macInputMode: firstCmac?.name ?? null,
    piccCandidates,
    cmacCandidates,
  };
}

export function generateSunParams(params: {
  uidHex: string;
  ctr: number;
  kMetaHex: string;
  kFileHex: string;
  encPlainHex?: string;
}) {
  const zeroIV = Buffer.alloc(16, 0x00) as NodeBuf;
  const uid = Buffer.from(params.uidHex, "hex") as NodeBuf;
  const uidLen = uid.length;
  if (uidLen < 4 || uidLen > 10) throw new Error("uid length invalid");

  const ctrBytes = Buffer.from([
    params.ctr & 0xff,
    (params.ctr >> 8) & 0xff,
    (params.ctr >> 16) & 0xff,
  ]) as NodeBuf;

  const piccPlain = Buffer.alloc(16, 0x00) as NodeBuf;
  piccPlain[0] = 0x80 | uidLen;
  uid.copy(piccPlain, 1);
  ctrBytes.copy(piccPlain, 1 + uidLen);

  const kMeta = Buffer.from(params.kMetaHex, "hex") as NodeBuf;
  const kFile = Buffer.from(params.kFileHex, "hex") as NodeBuf;
  const piccData = aes128CbcEncrypt(kMeta, zeroIV, piccPlain);

  const sv1 = Buffer.concat([Buffer.from("C33C00010080", "hex"), uid, ctrBytes]) as NodeBuf;
  const sv2 = Buffer.concat([Buffer.from("3CC300010080", "hex"), uid, ctrBytes]) as NodeBuf;
  const kSesEnc = aesCmac(kFile, sv1);
  const kSesMac = aesCmac(kFile, sv2);

  const encPlain = Buffer.from(params.encPlainHex || "00000000000000000000000000000000", "hex") as NodeBuf;
  const iveInput = Buffer.concat([ctrBytes, Buffer.alloc(13, 0x00)]) as NodeBuf;
  const ive = aes128CbcEncrypt(kSesEnc, zeroIV, iveInput);
  const enc = aes128CbcEncrypt(kSesEnc, ive, encPlain);

  const msg = buildMacInput(DEFAULT_SUN_MAC_INPUT_MODE, bufToHex(piccData), bufToHex(enc));
  const cmac = truncateMac8(aesCmac(kSesMac, msg));

  return {
    piccDataHex: bufToHex(piccData).toUpperCase(),
    encHex: bufToHex(enc).toUpperCase(),
    cmacHex: bufToHex(cmac).toUpperCase(),
  };
}
