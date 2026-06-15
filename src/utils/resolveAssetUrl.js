const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";
export const API_ASSET_BASE_URL = String(rawApiUrl).replace(/\/$/, "");

export function resolveAssetUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("blob:")) return value;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^https?:\/\/api\.movyo\.delivery/i, API_ASSET_BASE_URL);
  }
  if (value.startsWith("/")) return `${API_ASSET_BASE_URL}${value}`;
  if (value.startsWith("uploads/")) return `${API_ASSET_BASE_URL}/${value}`;
  return value;
}

export function resolveLogoUrl(restaurante = {}, fallback = "") {
  return resolveAssetUrl(
    restaurante?.logoUrl ||
      restaurante?.logoSlug ||
      restaurante?.logo ||
      restaurante?.imagem ||
      fallback
  );
}
