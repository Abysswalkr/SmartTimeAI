import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { getRoute, getBestDepartureTime } from "./api";
import { RouteOption, RouteResponse, DepartureResponse } from "./types";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function formatMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}

function formatKm(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function App() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [arrivalTime, setArrivalTime] = useState("");
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [departureData, setDepartureData] = useState<DepartureResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    avoidTolls: false,
    preferHighways: false,
    avoidFerries: false,
  });

  useEffect(() => {
    if (!useMyLocation) return;
    if (!navigator.geolocation) {
      setError("Geolocalización no disponible en este navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      () => setError("No pudimos obtener tu ubicación."),
      { enableHighAccuracy: true }
    );
  }, [useMyLocation]);

  const handleRouteSearch = async () => {
    if (useMyLocation && !currentLocation) {
      setError("Activa la geolocalización para usar tu ubicación como origen.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        origin: useMyLocation && currentLocation ? currentLocation : origin,
        destination,
        preferences,
      };
      const data = await getRoute(payload);
      setRouteData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Error obteniendo ruta");
    } finally {
      setLoading(false);
    }
  };

  const handleDepartureSearch = async () => {
    if (!arrivalTime) {
      setError("Indica a qué hora quieres llegar.");
      return;
    }
    if (useMyLocation && !currentLocation) {
      setError("Activa la geolocalización para usar tu ubicación como origen.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        origin: useMyLocation && currentLocation ? currentLocation : origin,
        destination,
        arrivalTime,
      };
      const data = await getBestDepartureTime(payload);
      setDepartureData(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Error calculando horario");
    } finally {
      setLoading(false);
    }
  };

  const mapCenter = useMemo(() => {
    if (currentLocation) return [currentLocation.lat, currentLocation.lng] as [number, number];
    if (routeData?.recommended?.geometry?.length) {
      const [lat, lng] = routeData.recommended.geometry[0];
      return [lat, lng] as [number, number];
    }
    return [19.4326, -99.1332] as [number, number]; // CDMX centro por defecto
  }, [currentLocation, routeData]);

  const recommendedRoute = routeData?.recommended;
  const alternatives = routeData?.alternatives ?? [];

  return (
    <div className="layout">
      <div className="panel">
        <h2 className="section-title">SmartTime AI</h2>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Calcula la mejor ruta y la mejor hora para salir con explicaciones amigables.
        </p>

        <label>Origen</label>
        <input
          type="text"
          placeholder="Dirección o coordenadas"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          disabled={useMyLocation}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={useMyLocation}
            onChange={(e) => setUseMyLocation(e.target.checked)}
          />
          Usar mi ubicación
        </label>

        <label>Destino</label>
        <input
          type="text"
          placeholder="Dirección o coordenadas"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          <label>
            <input
              type="checkbox"
              checked={preferences.avoidTolls}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, avoidTolls: e.target.checked }))
              }
            />{" "}
            Evitar casetas
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.preferHighways}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, preferHighways: e.target.checked }))
              }
            />{" "}
            Preferir autopistas
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.avoidFerries}
              onChange={(e) =>
                setPreferences((p) => ({ ...p, avoidFerries: e.target.checked }))
              }
            />{" "}
            Evitar ferris
          </label>
        </div>

        <button onClick={handleRouteSearch} disabled={loading}>
          {loading ? "Calculando..." : "Calcular mejor ruta"}
        </button>

        <label>¿A qué hora quieres llegar?</label>
        <input
          type="datetime-local"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
        />
        <button onClick={handleDepartureSearch} disabled={loading}>
          {loading ? "Analizando..." : "Mejor hora para salir"}
        </button>

        {error && (
          <div className="explanation" style={{ background: "#fff4f4", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        {routeData && (
          <div>
            <h3 className="section-title">Rutas evaluadas</h3>
            <div className="route-list">
              {alternatives.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isRecommended={route.id === recommendedRoute?.id}
                />
              ))}
            </div>
            {routeData.explanation && (
              <div className="explanation">{routeData.explanation}</div>
            )}
          </div>
        )}

        {departureData && (
          <div>
            <h3 className="section-title">Hora recomendada</h3>
            <div className="route-item">
              <strong>{new Date(departureData.recommended.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>{" "}
              (llegada estimada:{" "}
              {new Date(departureData.recommended.arrivalTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              ) — {formatMinutes(departureData.recommended.estimatedDurationSeconds)}
              <div style={{ marginTop: 6 }}>
                Ruta: {departureData.recommended.route.summary} |
                Score: {departureData.recommended.score.toFixed(2)}
              </div>
            </div>
            {departureData.explanation && (
              <div className="explanation">{departureData.explanation}</div>
            )}
          </div>
        )}
      </div>

      <div className="map-card">
        <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {recommendedRoute && (
            <Polyline positions={recommendedRoute.geometry} color="#1a73e8" weight={6} />
          )}
          {alternatives
            .filter((r) => r.id !== recommendedRoute?.id)
            .map((route) => (
              <Polyline
                key={route.id}
                positions={route.geometry}
                color="#9ca3af"
                dashArray="10"
                weight={4}
              />
            ))}

          {currentLocation && (
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={markerIcon}>
              <Popup>Tu ubicación</Popup>
            </Marker>
          )}

          <div className="map-legend">
            <div className="legend-item">
              <span className="legend-color" style={{ background: "#1a73e8" }}></span>
              Recomendada
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: "#9ca3af" }}></span>
              Alternativas
            </div>
          </div>
        </MapContainer>
      </div>
    </div>
  );
}

function RouteCard({ route, isRecommended }: { route: RouteOption; isRecommended: boolean }) {
  return (
    <div className="route-item">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{route.summary}</strong>
        {isRecommended && <span className="tag">Recomendada</span>}
      </div>
      <div>
        {formatMinutes(route.durationSeconds)} • {formatKm(route.distanceMeters)} • Score:{" "}
        {route.score?.toFixed(2)}
      </div>
      {route.congestionLevel && <div>Tráfico: {route.congestionLevel}</div>}
      {route.blockedSegments && route.blockedSegments.length > 0 && (
        <div>Bloqueos: {route.blockedSegments.join(", ")}</div>
      )}
    </div>
  );
}
