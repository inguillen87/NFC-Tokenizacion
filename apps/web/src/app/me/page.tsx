import Link from "next/link";
import { asArray, buildConsumerNextPath, fetchConsumerMe, fetchConsumerPath, requireConsumerSession } from "./_components/consumer-api";
import { PortalShell } from "./_components/portal-shell";
import { resolveProductAssetProfile, summarizeAssetReadiness } from "../../lib/product-asset-bank";
import { MePortalInteractiveClient } from "./_components/me-portal-interactive-client";

type MePayload = {
  ok?: boolean;
  consumer?: { email?: string | null; display_name?: string | null; passport_status?: string | null; preferred_locale?: string | null; status?: string | null };
  stats?: { products?: number; taps?: number; memberships?: number; unread?: number; rewards?: number };
};

type Product = {
  product_name?: string;
  brand_name?: string | null;
  tenant_slug?: string;
  bid?: string | null;
  batch?: string | null;
  sku?: string | null;
  vertical?: string | null;
  category?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  photo_url?: string | null;
  photoUrl?: string | null;
  ownership_record_status?: string | null;
  ownership_status?: string | null;
  tokenization_tx_hash?: string | null;
  tokenization_token_id?: string | number | null;
  tokenization_status?: string | null;
  latest_tap_event_id?: string | null;
  first_tap_event_id?: string | null;
};

type Tap = { created_at?: string; verdict?: string; tenant_slug?: string; city?: string; country?: string };
type Brand = { slug?: string; name?: string; status?: string };

export default async function MePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) || {};
  await requireConsumerSession(buildConsumerNextPath("/me", params));
  const me = (await fetchConsumerMe()) as MePayload | null;
  const products = asArray<Product>(await fetchConsumerPath("products"));
  const taps = asArray<Tap>(await fetchConsumerPath("taps"));
  const brands = asArray<Brand>(await fetchConsumerPath("brands"));
  const stats = me?.stats || {};
  const activeMemberships = brands.filter((item) => String(item.status || "").toLowerCase() === "active").length;
  const verifiedProducts = products.filter((item) => String(item.ownership_record_status || item.ownership_status || "").toLowerCase() === "claimed").length;
  const latestTaps = taps.slice(0, 5);
  const savedProducts = products.slice(0, 5);
  
  const savedProductProfiles = savedProducts.map((product) => ({
    product,
    profile: resolveProductAssetProfile({
      tenantSlug: product.tenant_slug,
      brandName: product.brand_name || product.tenant_slug,
      productName: product.product_name,
      bid: product.bid || product.batch,
      vertical: product.vertical,
      category: product.category,
      imageUrl: product.imageUrl || product.image_url || product.photoUrl || product.photo_url,
      sku: product.sku,
    }),
  }));

  const featuredAsset = savedProductProfiles[0]?.profile || resolveProductAssetProfile({
    tenantSlug: brands[0]?.slug,
    brandName: brands[0]?.name,
    productName: "Gran Reserva Premium Magnum",
    imageUrl: "/images/premium_magnum.png"
  });
  
  // Use high-end visual if it is a fallback/default malbec
  if (!featuredAsset.primaryImageUrl || featuredAsset.primaryImageUrl.includes("pexels")) {
    featuredAsset.primaryImageUrl = "/images/premium_magnum.png";
  }

  const featuredAssetReadiness = summarizeAssetReadiness(featuredAsset);
  const passportReadiness = Math.min(100, 42 + verifiedProducts * 18 + activeMemberships * 12 + Math.min(20, latestTaps.length * 5));

  return (
    <PortalShell
      title="Tu Pasaporte de Productos Auténticos"
      subtitle="Todo lo que escaneaste y guardaste: trazabilidad, procedencia, propiedad garantizada, beneficios y marketplace en una sola cuenta premium."
      notificationCount={Number(stats.unread || 0)}
    >
      <MePortalInteractiveClient
        me={me}
        products={products}
        taps={taps}
        brands={brands}
        passportReadiness={passportReadiness}
        featuredAsset={featuredAsset}
        featuredAssetReadiness={featuredAssetReadiness}
      />
    </PortalShell>
  );
}
