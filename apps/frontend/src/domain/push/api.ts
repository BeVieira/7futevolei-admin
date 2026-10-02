import { API_BASE_URL, apiFetch, handleResponse } from "@utils";

const BASE_URL = `${API_BASE_URL}/push`;

function getPublicKey(): Promise<{ publicKey: string }> {
  return apiFetch(`${BASE_URL}/public-key`).then(res => handleResponse(res));
}

function subscribe(
  subscription: PushSubscriptionJSON,
  studentName?: string,
): Promise<void> {
  return apiFetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, studentName }),
  }).then(res => handleResponse(res));
}

function unsubscribe(endpoint: string): Promise<void> {
  return apiFetch(`${BASE_URL}/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).then(res => handleResponse(res));
}

export const pushApi = { getPublicKey, subscribe, unsubscribe };
