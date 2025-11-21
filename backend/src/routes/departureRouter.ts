import { Router } from "express";
import { fetchRoutes } from "../services/mapsService";
import { computeRouteScore } from "../services/scoringService";
import { generateLLMExplanation } from "../services/llmService";
import {
  DepartureTimeEvaluation,
  DepartureTimeResult,
  RouteOption,
} from "../types/index";

const router = Router();

router.post("/", async (req, res) => {
  const { origin, destination, arrivalTime } = req.body || {};

  if (!origin || !destination || !arrivalTime) {
    return res.status(400).json({
      error: "origin, destination y arrivalTime son requeridos (ISO 8601)",
    });
  }

  try {
    const arrival = new Date(arrivalTime);
    const candidateDepartures = buildCandidateDepartures(arrival);

    const evaluations: DepartureTimeEvaluation[] = [];

    for (const departure of candidateDepartures) {
      const routes = await fetchRoutes(origin, destination, {
        departureTime: departure.toISOString(),
      });

      const bestRoute = pickBestRoute(routes);
      const arrivalEstimate = new Date(
        departure.getTime() + bestRoute.durationSeconds * 1000
      ).toISOString();

      evaluations.push({
        departureTime: departure.toISOString(),
        arrivalTime: arrivalEstimate,
        estimatedDurationSeconds: bestRoute.durationSeconds,
        route: bestRoute,
        score: bestRoute.score!,
      });
    }

    const recommended = evaluations.reduce((best, current) =>
      current.score < best.score ? current : best
    );

    const explanation = await generateLLMExplanation({
      departureChoice: recommended,
    });

    const result: DepartureTimeResult = {
      recommended,
      candidates: evaluations,
      explanation,
    };

    res.json(result);
  } catch (error: any) {
    console.error("Error /api/departure-time", error);
    res.status(500).json({ error: error.message || "Error calculando horario" });
  }
});

function buildCandidateDepartures(arrival: Date): Date[] {
  // Try several departures before the desired arrival (minutes).
  const offsetsMinutes = [90, 60, 45, 30, 15];
  return offsetsMinutes.map(
    (m) => new Date(arrival.getTime() - m * 60 * 1000)
  );
}

function pickBestRoute(routes: RouteOption[]): RouteOption {
  const scored = routes.map((r) => ({
    ...r,
    score: computeRouteScore(r),
  }));

  return scored.reduce((best, current) =>
    current.score! < best.score! ? current : best
  );
}

export default router;
