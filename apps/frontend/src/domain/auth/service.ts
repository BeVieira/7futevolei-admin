import { authApi } from "./api";

function login(username: string, password: string) {
  return authApi.login(username, password);
}

function logout() {
  return authApi.logout();
}

function getMe() {
  return authApi.getMe();
}

export const authService = { login, logout, getMe };
