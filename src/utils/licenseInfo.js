const LICENSE_DATE_FIELDS = [
  "dataFimPlano",
  "dataVencimentoPlano",
  "vencimentoPlano",
  "vencimento",
  "licencaAte",
  "licençaAte",
  "licencaValidaAte",
  "licençaValidaAte",
  "validadePlano",
  "validade",
  "assinaturaAte",
  "expiresAt",
];

export function normalizeRestaurantData(payload) {
  if (!payload || typeof payload !== "object") return {};
  return payload.restaurante && typeof payload.restaurante === "object"
    ? payload.restaurante
    : payload;
}

export function parseLicenseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateOnly) {
    const date = new Date(
      Number(isoDateOnly[1]),
      Number(isoDateOnly[2]) - 1,
      Number(isoDateOnly[3]),
      23,
      59,
      59,
      999
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLicenseDateBR(value) {
  const date = value instanceof Date ? value : parseLicenseDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function getLicenseInfo(restaurante = {}, now = new Date()) {
  const data = normalizeRestaurantData(restaurante);
  const dates = LICENSE_DATE_FIELDS
    .map((field) => parseLicenseDate(data?.[field]))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const expirationDate = dates[0] || null;

  if (!expirationDate) {
    return {
      hasDate: false,
      daysLeft: null,
      title: "Licença sem vencimento informado",
      subtitle: "Não encontrei a data de vencimento no cadastro.",
      tone: "neutral",
    };
  }

  const current = now instanceof Date ? now : new Date(now);
  const todayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const expirationStart = new Date(
    expirationDate.getFullYear(),
    expirationDate.getMonth(),
    expirationDate.getDate()
  );
  const daysLeft = Math.ceil((expirationStart.getTime() - todayStart.getTime()) / 86400000);

  if (daysLeft < 0) {
    return {
      hasDate: true,
      daysLeft,
      title: "Licença vencida",
      subtitle: `Venceu em ${formatLicenseDateBR(expirationDate)}. Regularize para continuar usando o Movyo.`,
      tone: "danger",
    };
  }

  if (daysLeft === 0) {
    return {
      hasDate: true,
      daysLeft,
      title: "Licença vence hoje",
      subtitle: "A licença expira hoje. Regularize para evitar bloqueio do acesso.",
      tone: "warning",
    };
  }

  const warning = daysLeft <= 7;
  return {
    hasDate: true,
    daysLeft,
    title: `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`,
    subtitle: `Licença válida até ${formatLicenseDateBR(expirationDate)}.${
      warning ? " Renove em breve para evitar interrupção." : " Tudo certo por aqui."
    }`,
    tone: warning ? "warning" : "success",
  };
}
