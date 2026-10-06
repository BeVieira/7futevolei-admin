import { Side } from "@domain/enrollment/types";
import { userApi } from "./api";

const MAX_NAME_LENGTH = 100;

function searchUsers(search: string) {
  return userApi.searchUsers(search);
}

function updateMyName(name: string) {
  return userApi.updateMyName(name);
}

function updateMyPreferredSide(preferredSide: Side) {
  return userApi.updateMyPreferredSide(preferredSide);
}

// Mesma regra do backend (1–100 caracteres, sem espaços nas pontas), pra a
// tela desabilitar o "Salvar" antes de mandar um nome que seria recusado.
function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
}

// Inicial pro avatar quando não há foto (ou ela não carrega).
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export const userService = {
  searchUsers,
  updateMyName,
  updateMyPreferredSide,
  isValidName,
  initialOf,
  MAX_NAME_LENGTH,
};
