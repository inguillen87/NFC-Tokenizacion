export type CityNode = {
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export type NearestCityMatch = CityNode & {
  distanceKm: number;
};

const EARTH_RADIUS_KM = 6371;
const DEFAULT_MAX_DISTANCE_KM = 150;

const CITIES: CityNode[] = [
  { city: "Mendoza", countryCode: "AR", lat: -32.8895, lng: -68.8458 },
  { city: "Valle de Uco", countryCode: "AR", lat: -33.6041, lng: -69.1204 },
  { city: "San Rafael", countryCode: "AR", lat: -34.6177, lng: -68.3301 },
  { city: "Buenos Aires", countryCode: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "San Martin", countryCode: "AR", lat: -34.5744, lng: -58.5358 },
  { city: "Cordoba", countryCode: "AR", lat: -31.4201, lng: -64.1888 },
  { city: "Rosario", countryCode: "AR", lat: -32.9442, lng: -60.6505 },
  { city: "Mar del Plata", countryCode: "AR", lat: -38.0055, lng: -57.5426 },
  { city: "Santa Fe", countryCode: "AR", lat: -31.6107, lng: -60.6973 },
  { city: "Montevideo", countryCode: "UY", lat: -34.9011, lng: -56.1645 },
  { city: "Santiago", countryCode: "CL", lat: -33.4489, lng: -70.6693 },
  { city: "Sao Paulo", countryCode: "BR", lat: -23.5505, lng: -46.6333 },
  { city: "Rio de Janeiro", countryCode: "BR", lat: -22.9068, lng: -43.1729 },
  { city: "Lima", countryCode: "PE", lat: -12.0464, lng: -77.0428 },
  { city: "Bogota", countryCode: "CO", lat: 4.711, lng: -74.0721 },
  { city: "Ciudad de Mexico", countryCode: "MX", lat: 19.4326, lng: -99.1332 },
  { city: "Ashburn", countryCode: "US", lat: 39.0438, lng: -77.4874 },
  { city: "Miami", countryCode: "US", lat: 25.7617, lng: -80.1918 },
  { city: "Madrid", countryCode: "ES", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", countryCode: "ES", lat: 41.3851, lng: 2.1734 },
  { city: "Paris", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "London", countryCode: "GB", lat: 51.5074, lng: -0.1278 },
];

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestCity(
  lat: number,
  lng: number,
  maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
): NearestCityMatch | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let nearest: NearestCityMatch | null = null;
  for (const node of CITIES) {
    const distanceKm = haversineDistanceKm(lat, lng, node.lat, node.lng);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { ...node, distanceKm };
    }
  }

  return nearest && nearest.distanceKm <= maxDistanceKm ? nearest : null;
}
