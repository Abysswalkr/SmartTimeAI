import { Router } from "express";
import { fetchRoutes } from "../services/mapsService";
import { computeRouteScore } from "../services/scoringService";
import { generateLLMExplanation } from "../services/llmService";
import { RouteOption, ScoredRouteResult } from "../types/index";

const router = Router();

router.post("/", async (req, res) => {
  const { origin, destination, preferences } = req.body || {};

  if (!origin || !destination) {
    return res.status(400).json({ error: "origin y destination son requeridos" });
  }

  try {
    const routes = await fetchRoutes(origin, destination, { preferences });
    const scored = scoreRoutes(routes);

    const explanation = await generateLLMExplanation({
      routes: scored.alternatives,
      recommended: scored.recommended,
    });

    res.json({ ...scored, explanation });
  } catch (error: any) {
    console.error("Error /api/route", error);
    res.status(500).json({ error: error.message || "Error calculando ruta" });
  }
});

function scoreRoutes(routes: RouteOption[]): ScoredRouteResult {
  const scoredRoutes = routes.map((r) => ({
    ...r,
    score: computeRouteScore(r),
  }));

  const recommended = scoredRoutes.reduce((best, current) =>
    current.score! < best.score! ? current : best
  );

  return {
    recommended,
    alternatives: scoredRoutes,
  };
}

export default router;
