// Published catalogue projections for local production-page QA only. No real
// account, tap, stock, payment or provider data is read or written.
export const marketplaceFixtureItems = [
  { id: "market-wine-qa", title: "Vino reserva QA", tenant_slug: "consumer-qa", brand_name: "Bodega de ensayo", kind: "wine", bid: "LOT-WINE-QA", stock_status: "active", request_to_buy_enabled: true, age_gate_required: true, cash_price: 18000.5, price_currency: "ARS", image_url: "/images/premium_wine_mendoza_nfc.png?qa=published" },
  { id: "market-olive-qa", title: "Oliva QA", tenant_slug: "consumer-qa", brand_name: "Bodega de ensayo", kind: "olive", bid: "LOT-WINE-QA", stock_status: "in_stock", request_to_buy_enabled: true, cash_price: 15, price_currency: "USD", photo_url: "/images/wine_crate.png?qa=published" },
  { id: "market-experience-qa", title: "Cata QA", tenant_slug: "consumer-qa", brand_name: "Bodega de ensayo", kind: "experience", bid: "LOT-WINE-QA", stock_status: "sold_out", request_to_buy_enabled: true, imageUrl: "/images/wine_tasting.png?qa=published" },
  { id: "market-no-photo-qa", title: "Producto sin foto QA", tenant_slug: "consumer-qa", brand_name: "Bodega de ensayo", kind: "other", stock_status: "active", request_to_buy_enabled: false },
  // The URL is a synthetic published photo projection. Browser QA returns
  // invalid PNG bytes for this exact loopback GET to exercise actual decoding
  // failure without changing an existing photo or fetching a provider.
  { id: "market-cafe-zero-qa", title: "Café QA", tenant_slug: "consumer-qa", brand_name: "Marca de ensayo", vertical: "gourmet", category: "café", status: "active", request_to_buy_enabled: false, price_amount: "0.00", price_currency: "USD", image_url: "/images/wine_crate.png?qa=decode-failure" },
  { id: "market-price-null-qa", title: "Libro QA", tenant_slug: "consumer-qa", brand_name: "Club Catamarca QA", vertical: "books", category: "books", status: "active", request_to_buy_enabled: false, price_amount: null, price_currency: null },
  // Deliberately incomplete legacy projection: a numeric amount cannot confer
  // a currency that the source did not supply. This is not a valid API write.
  { id: "market-no-currency-qa", title: "Producto sin moneda QA", tenant_slug: "consumer-qa", brand_name: "Marca de ensayo", status: "active", request_to_buy_enabled: false, price_amount: "20.00" },
];

export const marketplaceBrokenPhotoFixture = marketplaceFixtureItems.find(item => item.id === "market-cafe-zero-qa");
