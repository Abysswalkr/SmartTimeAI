export type LocationInput = string | { lat: number; lng: number };

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RoutePreferences {
  avoidTolls?: boolean;
  preferHighways?: boolean;
  avoidFerries?: boolean;
}

export interface RouteOption {
  id: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: number[][];
  numberOfTurns?: number;
  congestionLevel?: "low" | "medium" | "high";
  blockedSegments?: string[];
  score?: number;
}

export interface ScoredRouteResult {
  recommended: RouteOption;
  alternatives: RouteOption[];
  explanation?: string;
}

export interface DepartureTimeEvaluation {
  departureTime: string;
  arrivalTime: string;
  estimatedDurationSeconds: number;
  route: RouteOption;
  score: number;
}

export interface DepartureTimeResult {
  recommended: DepartureTimeEvaluation;
  candidates: DepartureTimeEvaluation[];
  explanation?: string;
}
