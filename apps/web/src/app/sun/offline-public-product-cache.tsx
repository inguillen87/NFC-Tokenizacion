"use client";

import { useEffect } from "react";
import { cacheOfflinePublicProduct } from "../offline/offline-store";
import type { AgroDppProfile } from "./agro-dpp-model";

type OfflinePublicProductCacheProps = {
  enabled: boolean;
  bid: string;
  name?: string | null;
  brand?: string | null;
  region?: string | null;
  origin?: string | null;
  storage?: string | null;
  notes?: string | null;
  agro?: AgroDppProfile | null;
};

function publicText(value: string | null | undefined, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function OfflinePublicProductCache({
  enabled,
  bid,
  name,
  brand,
  region,
  origin,
  storage,
  notes,
  agro,
}: OfflinePublicProductCacheProps) {
  useEffect(() => {
    const safeBid = bid.trim();
    if (!enabled || !/^[A-Za-z0-9._:-]{3,120}$/.test(safeBid)) return;

    void cacheOfflinePublicProduct({
      bid: safeBid,
      name: publicText(name, 120) || undefined,
      brand: publicText(brand, 120) || undefined,
      region: publicText(region, 120) || undefined,
      origin: publicText(origin, 160) || undefined,
      storage: publicText(storage, 180) || undefined,
      notes: publicText(notes, 320) || undefined,
      agro: agro ? {
        crop: publicText(agro.crop, 120) || undefined,
        seedVariety: publicText(agro.seedVariety, 160) || undefined,
        productFamily: publicText(agro.productFamily, 160) || undefined,
        activeIngredient: publicText(agro.activeIngredient, 240) || undefined,
        formulation: publicText(agro.formulation, 160) || undefined,
        registrationNumber: publicText(agro.registrationNumber, 160) || undefined,
        batchLot: publicText(agro.batchLot, 160) || undefined,
        productionDate: publicText(agro.productionDate, 40) || undefined,
        expirationDate: publicText(agro.expirationDate, 40) || undefined,
        distributor: publicText(agro.distributor, 200) || undefined,
        authorizedChannel: publicText(agro.authorizedChannel, 200) || undefined,
        ppeSummary: publicText(agro.ppe.summary, 600) || undefined,
        ppeItems: agro.ppe.items.map((item) => publicText(item, 180)).filter(Boolean).slice(0, 12),
        stewardshipSummary: publicText(agro.stewardship.summary, 1_000) || undefined,
        stewardshipItems: agro.stewardship.items.map((item) => publicText(item, 180)).filter(Boolean).slice(0, 12),
      } : undefined,
      cachedAt: new Date().toISOString(),
    }).catch(() => {
      // Cached public context is optional and must never interrupt the passport.
    });
  }, [agro, bid, brand, enabled, name, notes, origin, region, storage]);

  return null;
}
