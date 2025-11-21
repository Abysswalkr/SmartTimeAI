import axios from "axios";
import { LLM_API_KEY, LLM_BASE_URL } from "../config/env";
import { RouteOption, DepartureTimeEvaluation } from "../types/index";

interface ExplanationInput {
  routes?: RouteOption[];
  recommended?: RouteOption;
  departureChoice?: DepartureTimeEvaluation;
}

export async function generateLLMExplanation(
  input: ExplanationInput
): Promise<string | undefined> {
  if (!LLM_API_KEY) {
    return "Explicación generada localmente: se priorizó el menor tiempo y menor distancia, penalizando giros y bloqueos.";
  }

  const systemMessage =
    "Eres un asistente de rutas. Responde en español de forma breve (1-2 oraciones).";

  const userMessage = buildUserMessage(input);

  try {
    const response = await axios.post(
      `${LLM_BASE_URL}/chat/completions`,
      {
        model: "x-ai/grok-4.1-fast:free",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 120,
      },
      {
        headers: {
          Authorization: `Bearer ${LLM_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "SmartTime AI",
        },
        timeout: 12000,
      }
    );


    return response.data?.choices?.[0]?.message?.content?.trim();
  } catch (error) {
    console.warn("LLM call failed, returning fallback message", error);
    return "Explicación automática no disponible ahora, pero la ruta seleccionada minimiza tiempo y distancia con las preferencias actuales.";
  }
}

function buildUserMessage(input: ExplanationInput): string {
  if (input.departureChoice) {
    const { departureChoice } = input;
    return [
      `Busca explicar por qué salir a ${departureChoice.departureTime} es buena idea.`,
      `Duración estimada: ${(departureChoice.estimatedDurationSeconds / 60).toFixed(1)} min.`,
      `Puntaje usado: ${departureChoice.score.toFixed(2)}. Penalizamos tráfico y giros.`,
      `Ruta: ${departureChoice.route.summary} (${(departureChoice.route.distanceMeters / 1000).toFixed(1)} km).`,
    ].join("\n");
  }

  const recommended = input.recommended;
  if (!recommended) return "Explica la ruta recomendada de manera amigable.";

  const altInfo =
    input.routes
      ?.map(
        (r) =>
          `${r.id}: ${(r.durationSeconds / 60).toFixed(1)} min, ${(r.distanceMeters / 1000).toFixed(1)} km, score ${r.score?.toFixed(2)}`
      )
      .join("; ") || "";

  return [
    `Ruta recomendada: ${recommended.summary}`,
    `Tiempo ${(recommended.durationSeconds / 60).toFixed(1)} min, distancia ${(recommended.distanceMeters / 1000).toFixed(1)} km.`,
    `Comparadas: ${altInfo}`,
    "Explica en español por qué se eligió y menciona si evita tráfico o bloqueos.",
  ].join("\n");
}
