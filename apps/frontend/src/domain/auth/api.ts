import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import { Me } from "./types";

const BASE_URL = `${API_BASE_URL}/auth`;

function login(username: string, password: string): Promise<Me> {
  return fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  }).then((res) => handleResponse(res));
}

function logout(): Promise<void> {
  return fetch(`${BASE_URL}/logout`, {
    method: "POST",
    credentials: "include",
  }).then((res) => handleResponse(res));
}

function getMe(): Promise<Me> {
  return apiFetch(`${BASE_URL}/me`).then((res) => handleResponse(res));
}

export const authApi = { login, logout, getMe };
