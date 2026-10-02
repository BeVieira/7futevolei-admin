import { API_BASE_URL, apiFetch, handleResponse } from "@utils";
import { Me } from "@domain/auth/types";
import { UserSearchResult } from "./types";

const BASE_URL = `${API_BASE_URL}/users`;

function searchUsers(search: string): Promise<UserSearchResult[]> {
  return apiFetch(`${BASE_URL}?search=${encodeURIComponent(search)}`).then(
    res => handleResponse(res),
  );
}

function updateMyName(name: string): Promise<Me> {
  return apiFetch(`${BASE_URL}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(res => handleResponse(res));
}

export const userApi = { searchUsers, updateMyName };
