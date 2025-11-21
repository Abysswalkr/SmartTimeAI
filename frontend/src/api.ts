import axios from "axios";
import { RouteResponse, DepartureResponse } from "./types";

const client = axios.create({
  baseURL: "/api",
});

export async function getRoute(payload: {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
  preferences?: { avoidTolls?: boolean; preferHighways?: boolean; avoidFerries?: boolean };
}): Promise<RouteResponse> {
  const { data } = await client.post<RouteResponse>("/route", payload);
  return data;
}

export async function getBestDepartureTime(payload: {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
  arrivalTime: string;
}): Promise<DepartureResponse> {
  const { data } = await client.post<DepartureResponse>("/departure-time", payload);
  return data;
}
