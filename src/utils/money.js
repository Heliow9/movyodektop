export const toMoneyNumber = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;

  let str = String(value)
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!str) return 0;

  const hasComma = str.includes(",");
  const hasDot = str.includes(".");

  if (hasComma) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = str.split(".");
    const last = parts[parts.length - 1];
    str = last.length === 3 && parts.length > 1 ? parts.join("") : str;
  }

  const n = Number(str);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
};

export const toBRL = (value) =>
  toMoneyNumber(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
