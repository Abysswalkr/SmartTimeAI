import axios, { AxiosInstance, AxiosError } from "axios";
import {
  MAPS_API_KEY,
  MAPS_BASE_URL,
  MAPS_SIMULATION_MODE,
} from "../config/env";
import {
  Coordinate,
  LocationInput,
  RouteOption,
  RoutePreferences,
} from "../types/index";

const mapsClient: AxiosInstance = axios.create({
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
  if (MAPS_SIMULATION_MODE) {
    const known = lookupKnownLocation(text);
    if (known) return known;
    const hash = hashText(text);
    const baseLat = 14.6 + ((hash % 200) - 100) * 0.001; // ~14.5 a ~14.7
    const baseLng = -90.6 + (((hash >> 3) % 200) - 100) * 0.001; // ~-90.8 a ~-90.4
    return { lat: baseLat, lng: baseLng };
  }

  if (!MAPS_API_KEY) {
    throw new Error("MAPS_API_KEY es requerido para usar OpenRouteService");
  }

  const response = await mapsClient.get("/geocode/search", {
    params: {
      text,
      size: 1,
    },
  });

  const feature = response.data?.features?.[0];
  const coords: number[] | undefined = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    throw new Error(`No se pudo geocodificar "${text}"`);
  }

  const [lng, lat] = coords;
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
  if (MAPS_SIMULATION_MODE) {
    console.log("MapsService corriendo en modo SIMULACIÓN (sin llamadas externas)");
    const origin = await resolveLocation(originInput);
    const destination = await resolveLocation(destinationInput);
    return simulateRoutes(origin, destination);
  }

  if (!MAPS_API_KEY) {
    throw new Error("MAPS_API_KEY es requerido para usar OpenRouteService");
  }

  const origin = await resolveLocation(originInput);
  const destination = await resolveLocation(destinationInput);

  const approxDistanceKm = haversineMeters(origin, destination) / 1000;

  const bodyBase: any = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    instructions: true,
    elevation: false,
  };

  const allowAlternatives = approxDistanceKm <= 100;
  const bodyWithAlternatives = allowAlternatives
    ? {
        ...bodyBase,
        alternative_routes: {
          target_count: 3,
          share_factor: 0.6,
          weight_factor: 1.4,
        },
      }
    : bodyBase;

  try {
    const routes = await requestDirections(
      bodyWithAlternatives,
      allowAlternatives ? bodyBase : null
    );
    if (!routes.length) {
      console.error("ORS respondió sin rutas parseables");
      throw new Error("No se obtuvieron rutas del proveedor de mapas");
    }
    return routes;
  } catch (error: any) {
    const status = (error as AxiosError)?.response?.status;
    const data = (error as AxiosError)?.response?.data;
    console.error(
      "ORS directions error",
      `status: ${status}`,
      `data: ${data ? JSON.stringify(data) : "sin data"}`,
      `url: ${(error as AxiosError)?.config?.url}`
    );
    throw new Error(`Error llamando a OpenRouteService: ${error.message || "sin detalle"}`);
  }
}

async function requestDirections(body: any, fallbackBody: any): Promise<RouteOption[]> {
  try {
    const response = await mapsClient.post("/v2/directions/driving-car", body);
    return parseDirectionsResponse(response.data);
  } catch (error: any) {
    const status = error?.response?.status;
    const code = error?.response?.data?.error?.code;
    if (fallbackBody && status === 400 && code === 2004) {
      console.warn("ORS rechazó alternative_routes (code 2004). Reintentando sin alternativas.");
      const response = await mapsClient.post("/v2/directions/driving-car", fallbackBody);
      return parseDirectionsResponse(response.data);
    }
    throw error;
  }
}

function parseDirectionsResponse(data: any): RouteOption[] {
  const features = data?.features ?? [];
  if (!Array.isArray(features)) {
    console.error("ORS respuesta inesperada (sin features):", JSON.stringify(data));
    return [];
  }

  const routes: RouteOption[] = [];

  features.forEach((f: any, idx: number) => {
    const props = f.properties ?? {};
    const summary = props.summary ?? {};
    const segments = props.segments ?? [];
    const firstSegment = segments[0] ?? {};
    const steps = firstSegment.steps ?? [];

    const distance =
      Number(summary.distance) ||
      Number(firstSegment.distance) ||
      0;
    const duration =
      Number(summary.duration) ||
      Number(firstSegment.duration) ||
      0;

    const coords: number[][] = f.geometry?.coordinates ?? [];
    if (!distance || !duration || !coords.length) return;

    const geometry = coords.map(([lng, lat]: number[]) => [lat, lng]);

    routes.push({
      id: `ors-${idx + 1}`,
      summary: summary.text || `Ruta ${idx + 1}`,
      distanceMeters: distance,
      durationSeconds: duration,
      geometry,
      numberOfTurns: steps.length || Math.max(1, Math.floor(coords.length / 15)),
      congestionLevel: "unknown",
      blockedSegments: [],
    });
  });

  if (!routes.length) {
    console.error("ORS features sin rutas útiles:", JSON.stringify(data));
  }

  return routes;
}

function haversineMeters(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// ----- Simulación -----

function simulateRoutes(origin: Coordinate, destination: Coordinate): RouteOption[] {
  const variants = [
    { name: "Ruta directa", distFactor: 1.0, durExtraSec: 0, turns: 12, bendKm: 0.8 },
    { name: "Ruta panoramica", distFactor: 1.25, durExtraSec: 600, turns: 18, bendKm: -1.2 },
    { name: "Ruta con menos giros", distFactor: 1.1, durExtraSec: 300, turns: 8, bendKm: 0.4 },
  ];

  const baseDistance = haversineMeters(origin, destination);
  const baseDuration = baseDistance / 12; // ~12 m/s (~43 km/h)

  return variants.map((v, idx) => {
    const distance = baseDistance * v.distFactor;
    const duration = baseDuration * v.distFactor + v.durExtraSec;
    return {
      id: `sim-${idx + 1}`,
      summary: v.name,
      distanceMeters: distance,
      durationSeconds: duration,
      geometry: curvedLine(origin, destination, v.bendKm, 40),
      numberOfTurns: v.turns,
      congestionLevel: "unknown",
      blockedSegments: [],
    };
  });
}

function curvedLine(
  origin: Coordinate,
  destination: Coordinate,
  bendKm: number,
  samples: number
): number[][] {
  // Quadratic bezier with perpendicular offset at midpoint.
  const out: number[][] = [];
  const dx = destination.lng - origin.lng;
  const dy = destination.lat - origin.lat;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = -dy / len;
  const uy = dx / len;
  const offsetDeg = (bendKm / 111) * 0.5; // km -> deg approx, scaled
  const midLat = (origin.lat + destination.lat) / 2 + uy * offsetDeg;
  const midLng = (origin.lng + destination.lng) / 2 + ux * offsetDeg;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const lat =
      (1 - t) * (1 - t) * origin.lat + 2 * (1 - t) * t * midLat + t * t * destination.lat;
    const lng =
      (1 - t) * (1 - t) * origin.lng + 2 * (1 - t) * t * midLng + t * t * destination.lng;
    out.push([lat, lng]);
  }
  return out;
}

function lookupKnownLocation(text: string): Coordinate | null {
  const key = text.toLowerCase();
  const entries: Record<string, Coordinate> = {
    "irtra petapa": { lat: 14.5055, lng: -90.5725 },
    "irtra petapa guatemala": { lat: 14.5055, lng: -90.5725 },
    irtra: { lat: 14.5513, lng: -90.5105 },
    cayala: { lat: 14.6061, lng: -90.4863 },
    "ciudad cayala": { lat: 14.6061, lng: -90.4863 },
    guatemala: { lat: 14.6349, lng: -90.5069 },
    "guatemala city": { lat: 14.6349, lng: -90.5069 },
    "zona 10": { lat: 14.5954, lng: -90.5152 },
    "zona 15": { lat: 14.6091, lng: -90.4939 },
    peten: { lat: 16.9131, lng: -89.8975 },
  };
  for (const entry in entries) {
    if (key.includes(entry)) return entries[entry];
  }
  return null;
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
