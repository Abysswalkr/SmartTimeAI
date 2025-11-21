export interface RouteOption {
  id: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: number[][];
  numberOfTurns?: number;
  congestionLevel?: string;
  blockedSegments?: string[];
  score?: number;
}

export interface RouteResponse {
  recommended: RouteOption;
  alternatives: RouteOption[];
  explanation?: string;
}

export interface DepartureCandidate {
  departureTime: string;
  arrivalTime: string;
  estimatedDurationSeconds: number;
  route: RouteOption;
  score: number;
}

export interface DepartureResponse {
  recommended: DepartureCandidate;
  candidates: DepartureCandidate[];
  explanation?: string;
}
