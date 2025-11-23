# SmartTime AI

Pequeña demo que combina React + Express para elegir la mejor ruta y la mejor hora de salida, con explicaciones generadas por un LLM opcional.

## 📂 Estructura
- `frontend/`: React + Vite + TypeScript (mapa y UI).
- `backend/`: Express + TypeScript (llamadas a APIs de rutas y al LLM).
- `.env.example`: variables de entorno esperadas (sin llaves reales).

## 🚀 Instalación rápida
En dos terminales (o usando `npm install` en cada carpeta):
```bash
cd backend && npm install
cd ../frontend && npm install
```

## 🔑 Variables de entorno
Duplica `.env.example` a `.env` en la raíz o en cada servicio y completa:
- `MAPS_API_KEY` y `MAPS_BASE_URL`: tu proveedor de rutas (ej. OpenRouteService, Mapbox). Sin estas llaves se usan datos de demostración.
- `LLM_API_KEY` y `LLM_BASE_URL`: endpoint OpenAI-compatible (ej. OpenRouter) para generar texto.
- `PORT`: puerto del backend (default 4000).

## 🏃‍♂️ Cómo correr
Backend (puerto 4000 por defecto):
```bash
cd backend
npm run dev
```
Frontend (Vite proxy a `/api` hacia el backend):
```bash
cd frontend
npm run dev
```
Abre `http://localhost:5173`.

## 🧠 Dónde está la lógica “AI”
- Ponderación de rutas: `backend/src/services/scoringService.ts` (constantes `SCORE_WEIGHTS`, ajusta para priorizar tiempo, distancia, giros o bloqueos).
- Llamadas al proveedor de mapas: `backend/src/services/mapsService.ts` (usa `MAPS_API_KEY`/`MAPS_BASE_URL`, incluye modo demo sin llaves).
- Explicaciones con LLM: `backend/src/services/llmService.ts` (usa `LLM_BASE_URL` y `LLM_API_KEY`).
- Endpoints principales: `backend/src/routes/routeRouter.ts` y `backend/src/routes/departureRouter.ts`.

## ✏️ Extender la inteligencia después
- Ajusta `SCORE_WEIGHTS` o reemplaza `computeRouteScore` por un modelo ML entrenado.
- Añade más preferencias de usuario en `RoutePreferences` y pásalas a tu proveedor de mapas.
- Cambia el modelo en `llmService.ts` (campo `model`) o agrega contexto adicional al prompt.
