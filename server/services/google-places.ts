const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  rating?: number;
  location: {
    lat: number;
    lng: number;
  };
}

// Mock vendors for fallback when API key is not available
const MOCK_VENDORS = [
  {
    placeId: "mock-1",
    name: "Raj Silk House",
    address: "Godowlia, Varanasi, Uttar Pradesh 221001",
    phone: "+16179466711", // Test phone number
    rating: 4.5,
    location: { lat: 25.3176, lng: 82.9739 },
  },
  {
    placeId: "mock-2",
    name: "Banaras Silk Emporium",
    address: "Lanka, Varanasi, Uttar Pradesh 221005",
    phone: "+16179466711", // Test phone number
    rating: 4.3,
    location: { lat: 25.2820, lng: 82.9944 },
  },
  {
    placeId: "mock-3",
    name: "Heritage Saree Collection",
    address: "Chowk, Varanasi, Uttar Pradesh 221001",
    phone: "+16179466711", // Test phone number
    rating: 4.7,
    location: { lat: 25.3096, lng: 82.9790 },
  },
];

export async function searchPlaces(
  query: string,
  location?: string
): Promise<PlaceResult[]> {
  // Use mock data if API key is not available
  if (!GOOGLE_PLACES_API_KEY) {
    console.log("Using mock vendor data (Google Places API key not configured)");
    return MOCK_VENDORS;
  }

  try {
    const searchQuery = location
      ? `Banarasi saree shops in ${location}, India`
      : `Banarasi saree shops in Varanasi, India`;

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_PLACES_API_KEY}`
    );

    if (!response.ok) {
      console.warn("Google Places API error, using mock data");
      return MOCK_VENDORS;
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.log("No results from Google Places, using mock data");
      return MOCK_VENDORS;
    }

    return data.results.slice(0, 5).map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number || "+16179466711", // Use test default phone number
      rating: place.rating,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
    }));
  } catch (error) {
    console.error("Error fetching from Google Places:", error);
    return MOCK_VENDORS;
  }
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
