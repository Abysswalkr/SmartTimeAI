import dotenv from "dotenv";

dotenv.config();

export const MAPS_API_KEY = process.env.MAPS_API_KEY || "";
export const MAPS_BASE_URL =
  process.env.MAPS_BASE_URL || "https://api.openrouteservice.org";
export const MAPS_SIMULATION_MODE = process.env.MAPS_SIMULATION_MODE === "true";
export const LLM_API_KEY = process.env.LLM_API_KEY || "";
export const LLM_BASE_URL =
  process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";

export const APP_CONFIG = {
  // Port is set in index.ts; added here for completeness/centralization if needed.
  port: process.env.PORT || "4000",
};
