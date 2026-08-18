import { apiFetch, handleResponse } from "@utils";
import { Me } from "./types";

const BASE_URL = "/api/auth";

function login(username: string, password: string): Promise<Me> {
  return fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then((res) => handleResponse(res));
}

function logout(): Promise<void> {
  return fetch(`${BASE_URL}/logout`, { method: "POST" }).then((res) =>
    handleResponse(res),
  );
}

function getMe(): Promise<Me> {
  return apiFetch(`${BASE_URL}/me`).then((res) => handleResponse(res));
}

export const authApi = { login, logout, getMe };
