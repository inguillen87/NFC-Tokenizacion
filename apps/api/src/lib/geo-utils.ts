type CityNode = {
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
};

const CITIES: CityNode[] = [
  { city: "Mendoza", countryCode: "AR", lat: -32.8895, lng: -68.8458 },
  { city: "Valle de Uco", countryCode: "AR", lat: -33.6041, lng: -69.1204 },
  { city: "San Rafael", countryCode: "AR", lat: -34.6177, lng: -68.3301 },
  { city: "Buenos Aires", countryCode: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "San Martín", countryCode: "AR", lat: -34.5744, lng: -58.5358 },
  { city: "Córdoba", countryCode: "AR", lat: -31.4135, lng: -64.1810 },
  { city: "Rosario", countryCode: "AR", lat: -32.9442, lng: -60.6505 },
  { city: "Mar del Plata", countryCode: "AR", lat: -38.0055, lng: -57.5426 },
  { city: "Santiago", countryCode: "CL", lat: -33.4489, lng: -70.6693 },
  { city: "São Paulo", countryCode: "BR", lat: -23.5505, lng: -46.6333 },
  { city: "Rio de Janeiro", countryCode: "BR", lat: -22.9068, lng: -43.1729 },
  { city: "Lima", countryCode: "PE", lat: -12.0464, lng: -77.0428 },
  { city: "Bogotá", countryCode: "CO", lat: 4.7110, lng: -74.0721 },
  { city: "Ciudad de México", countryCode: "MX", lat: 19.4326, lng: -99.1332 },
  { city: "Ashburn (VA)", countryCode: "US", lat: 39.0438, lng: -77.4874 },
  { city: "Madrid", countryCode: "ES", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", countryCode: "ES", lat: 41.3851, lng: 2.1734 },
  { city: "Paris", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "London", countryCode: "GB", lat: 51.5074, lng: -0.12785 },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestCity(lat: number, lng: number, maxDistanceKm = 250): { city: string; countryCode: string } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let nearest: CityNode | null = null;
  let minDistance = Infinity;

  for (const node of CITIES) {
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = node;
    }
  }

  if (nearest && minDistance <= maxDistanceKm) {
    return {
      city: nearest.city,
      countryCode: nearest.countryCode,
    };
  }

  return null;
}
