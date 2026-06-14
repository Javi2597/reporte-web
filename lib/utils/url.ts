/**
 * Normaliza una URL ingresada por el usuario:
 * - Agrega https:// si no tiene protocolo
 * - Quita espacios
 * - Quita el trailing slash (salvo que sea la raíz "/")
 * - Valida que sea una URL http(s) parseable
 *
 * Lanza Error si no se puede normalizar a una URL http(s) válida.
 */
export function normalizeUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new Error("La URL está vacía.");
  }

  // Agregar protocolo si falta.
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`URL inválida: "${input}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Solo se admiten URLs http(s).");
  }

  if (!parsed.hostname.includes(".")) {
    throw new Error(`Dominio inválido: "${parsed.hostname}"`);
  }

  // Normalizar host a minúsculas, quitar trailing slash del pathname.
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  // Quitar hash.
  parsed.hash = "";

  // Reconstruir sin trailing slash si es la raíz vacía.
  let result = parsed.toString();
  if (result.endsWith("/") && parsed.pathname === "/") {
    result = result.slice(0, -1);
  }
  return result;
}

/** Devuelve el origin (scheme + host) de una URL, ej https://example.com */
export function getOrigin(url: string): string {
  return new URL(url).origin;
}
