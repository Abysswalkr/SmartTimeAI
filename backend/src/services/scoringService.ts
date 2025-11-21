import { RouteOption } from "../types/index";

// Scoring weights: tweak these to change the AI decision policy.
// Higher duration weight means the AI prioritizes time more than distance.
export const SCORE_WEIGHTS = {
  durationMinutes: 0.7, // w1
  distanceKm: 0.2, // w2
  turns: 0.1, // w3
  blockedPenalty: 20, // w4, penalty per blocked segment in minutes
};

export function computeRouteScore(route: RouteOption): number {
  const durationMinutes = route.durationSeconds / 60;
  const distanceKm = route.distanceMeters / 1000;
  const turns = route.numberOfTurns ?? Math.max(1, Math.floor(route.geometry.length / 10));
  const blocked = route.blockedSegments?.length ?? 0;

  return (
    SCORE_WEIGHTS.durationMinutes * durationMinutes +
    SCORE_WEIGHTS.distanceKm * distanceKm +
    SCORE_WEIGHTS.turns * turns +
    SCORE_WEIGHTS.blockedPenalty * blocked
  );
}
