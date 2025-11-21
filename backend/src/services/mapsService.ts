import axios, { AxiosInstance } from "axios";
import { MAPS_API_KEY, MAPS_BASE_URL } from "../config/env";
import {
  Coordinate,
  LocationInput,
  RouteOption,
  RoutePreferences,
} from "../types/index";

const http: AxiosInstance = axios.create({
  baseURL: MAPS_BASE_URL,
  timeout: 10000,
  headers: {
    Authorization: MAPS_API_KEY,
    "Content-Type": "application/json",
  },
});

function isCoordinate(value: LocationInput): value is { lat: number; lng: number } {
  return typeof value === "object" && value !== null && "lat" in value && "lng" in value;
}

export async function resolveLocation(input: LocationInput): Promise<Coordinate> {
  if (isCoordinate(input)) return input;

  const parsed = parseCoordinateString(input);
  if (parsed) return parsed;

  return geocodeText(input);
}

function parseCoordinateString(text: string): Coordinate | null {
  const parts = text.split(",").map((p) => p.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return null;
}

async function geocodeText(text: string): Promise<Coordinate> {
  if (!MAPS_API_KEY) {
    // Provide a deterministic coordinate when running without keys (demo mode).
    const hash = hashText(text);
    return {
      lat: 19.4326 + (hash % 20) * 0.001,
      lng: -99.1332 + ((hash >> 2) % 20) * 0.001,
    };
  }

  const response = await http.get("/geocode/search", {
    params: {
      api_key: MAPS_API_KEY,
      text,
      size: 1,
    },
  });

  const feature = response.data?.features?.[0];
  if (!feature?.geometry?.coordinates) {
    throw new Error(`No se pudo geocodificar "${text}"`);
  }

  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng };
}

interface DirectionOptions {
  departureTime?: string;
  preferences?: RoutePreferences;
}

export async function fetchRoutes(
  originInput: LocationInput,
  destinationInput: LocationInput,
  options: DirectionOptions = {}
): Promise<RouteOption[]> {
  const origin = await resolveLocation(originInput);
  const destination = await resolveLocation(destinationInput);

  if (!MAPS_API_KEY) {
    return mockRoutes(origin, destination);
  }

  // OpenRouteService example payload. Adjust to your provider easily.
  const body = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    instructions: true,
    elevation: false,
    alternative_routes: {
      target_count: 3,
      share_factor: 0.6,
      weight_factor: 1.4,
    },
    // Translate preferences to provider-specific options if needed.
    ...(options.preferences?.avoidTolls && { avoid_features: ["tollways"] }),
    ...(options.preferences?.avoidFerries && { avoid_features: ["ferries"] }),
  };

  const response = await http.post("/v2/directions/driving-car", body);

  const features = response.data?.features ?? [];
  if (!Array.isArray(features) || features.length === 0) {
    throw new Error("No se obtuvieron rutas del proveedor de mapas");
  }

  return features.map((f: any, idx: number) => {
    const coords: number[][] = f.geometry?.coordinates ?? [];
    const summary = f.properties?.summary ?? {};
    const segments = f.properties?.segments ?? [];
    const steps = segments[0]?.steps ?? [];

    return {
      id: `route-${idx + 1}`,
      summary: summary?.text || `Ruta ${idx + 1}`,
      distanceMeters: Number(summary?.distance) || 0,
      durationSeconds: Number(summary?.duration) || 0,
      geometry: coords.map(([lng, lat]: number[]) => [lat, lng]),
      numberOfTurns: steps?.length ?? Math.max(1, Math.floor(coords.length / 15)),
      congestionLevel: estimateCongestion(options.departureTime),
      blockedSegments: [],
    };
  });
}

function estimateCongestion(departureTime?: string): "low" | "medium" | "high" {
  if (!departureTime) return "medium";
  const hour = new Date(departureTime).getHours();
  if (hour >= 7 && hour <= 9) return "high";
  if (hour >= 17 && hour <= 20) return "high";
  if (hour >= 22 || hour <= 5) return "low";
  return "medium";
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mockRoutes(origin: Coordinate, destination: Coordinate): RouteOption[] {
  const baseGeometry: number[][] = [
    [origin.lat, origin.lng],
    [(origin.lat + destination.lat) / 2 + 0.02, (origin.lng + destination.lng) / 2 - 0.01],
    [destination.lat, destination.lng],
  ];

  return [
    {
      id: "mock-1",
      summary: "Ruta rápida (demo sin API)",
      distanceMeters: 12000,
      durationSeconds: 900,
      geometry: baseGeometry,
      numberOfTurns: 8,
      congestionLevel: "medium",
      blockedSegments: [],
    },
    {
      id: "mock-2",
      summary: "Ruta panorámica",
      distanceMeters: 14500,
      durationSeconds: 1100,
      geometry: baseGeometry.map(([lat, lng], i) => [lat + i * 0.01, lng - i * 0.005]),
      numberOfTurns: 11,
      congestionLevel: "low",
      blockedSegments: ["Obra menor en Av. Central"],
    },
    {
      id: "mock-3",
      summary: "Ruta con caseta",
      distanceMeters: 10000,
      durationSeconds: 1050,
      geometry: baseGeometry.map(([lat, lng], i) => [lat - i * 0.005, lng + i * 0.007]),
      numberOfTurns: 6,
      congestionLevel: "high",
      blockedSegments: [],
    },
  ];
}
