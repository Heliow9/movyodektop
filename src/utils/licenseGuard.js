// src/utils/licenseGuard.js
// Regra única de acesso por bloqueio administrativo e validade da licença.

const BLOCKED_WORDS = [
  "bloqueado",
  "bloqueada",
  "suspenso",
  "suspensa",
  "inativo",
  "inativa",
  "desativado",
  "desativada",
];

const EXPIRED_WORDS = [
  "vencido",
  "vencida",
  "expirado",
  "expirada",
  "inadimplente",
  "cancelado",
  "cancelada",
  "encerrado",
  "encerrada",
];

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
  "dataExpiracao",
  "dataExpiração",
  "expiresAt",
  "subscriptionExpiresAt",
  "trialEndsAt",
  "licencaExpiraEm",
  "licençaExpiraEm",
  "planoValidoAte",
  "planoVálidoAte",
];

export const RESTAURANTE_BLOQUEADO_MSG =
  "Restaurante bloqueado. Entre em contato com o suporte Movyo.";
export const LICENCA_VENCIDA_MSG =
  "Licença vencida. Regularize o plano para continuar usando o Movyo.";

function text(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function boolTrue(value) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["true", "1", "sim", "yes", "bloqueado", "suspenso"].includes(text(value));
  }
  return false;
}

function boolFalse(value) {
  if (value === false) return true;
  if (typeof value === "number") return value === 0;
  if (typeof value === "string") {
    return ["false", "0", "nao", "no", "inativo", "desativado"].includes(text(value));
  }
  return false;
}

export function parseAccessDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Datas de licença são tratadas como válidas até o fim do dia informado.
  // Isso também evita mudança de dia causada por UTC em valores ISO do MongoDB.
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isExpiredDate(value, now = new Date()) {
  const expiration = parseAccessDate(value);
  if (!expiration) return false;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expirationStart = new Date(
    expiration.getFullYear(),
    expiration.getMonth(),
    expiration.getDate()
  );

  return expirationStart.getTime() < todayStart.getTime();
}

export function pickRestauranteFromPayload(payload) {
  if (!payload || typeof payload !== "object") return null;

  const nested =
    payload.restaurante ||
    payload.restaurant ||
    payload.empresa ||
    payload.loja ||
    payload.data?.restaurante ||
    payload.data?.restaurant ||
    payload.data?.empresa ||
    payload.data?.loja ||
    payload.garcom?.restaurante ||
    payload.usuario?.restaurante;

  if (nested && typeof nested === "object") return nested;

  if (payload.data && typeof payload.data === "object" && payload.data !== payload) {
    const restaurantInsideData = pickRestauranteFromPayload(payload.data);
    if (restaurantInsideData) return restaurantInsideData;
  }

  // /api/restaurantes/me normalmente devolve o próprio restaurante na raiz.
  const looksLikeRestaurant = Boolean(
    payload._id ||
      payload.nome ||
      payload.nomeFantasia ||
      payload.email ||
      payload.slug ||
      LICENSE_DATE_FIELDS.some((field) => payload[field] != null) ||
      ["bloqueado", "blocked", "suspenso", "suspended", "ativo", "active"].some(
        (field) => payload[field] != null
      )
  );

  return looksLikeRestaurant ? payload : null;
}

export function isRestauranteBloqueado(restaurante = {}) {
  const r = restaurante || {};

  if ([r.bloqueado, r.blocked, r.suspenso, r.suspended].some(boolTrue)) return true;

  const activeFields = [r.ativo, r.active, r.habilitado, r.enabled];
  if (activeFields.some((value) => value != null && boolFalse(value))) return true;

  const statusFields = [
    r.status,
    r.statusConta,
    r.statusSistema,
    r.statusRestaurante,
    r.situacao,
    r.situação,
    r.situacaoConta,
  ];

  return statusFields.some((value) => {
    const status = text(value);
    return BLOCKED_WORDS.some((word) => status === word || status.includes(word));
  });
}

export function isLicencaVencida(restaurante = {}, now = new Date()) {
  const r = restaurante || {};
  const statusFields = [
    r.statusAssinatura,
    r.statusPlano,
    r.statusLicenca,
    r.statusLicença,
    r.planoStatus,
    r.assinaturaStatus,
    r.subscriptionStatus,
  ];

  const statusExpired = statusFields.some((value) => {
    const status = text(value);
    return EXPIRED_WORDS.some((word) => status === word || status.includes(word));
  });

  if (statusExpired) return true;

  return LICENSE_DATE_FIELDS.some((field) => isExpiredDate(r[field], now));
}

export function getRestauranteAccessBlockMessage(restaurante, now = new Date()) {
  if (!restaurante || typeof restaurante !== "object") return null;
  if (isRestauranteBloqueado(restaurante)) return RESTAURANTE_BLOQUEADO_MSG;
  if (isLicencaVencida(restaurante, now)) return LICENCA_VENCIDA_MSG;
  return null;
}

export function getAuthBlockMessageFromError(error) {
  const data = error?.response?.data || {};
  const rawMessage =
    data?.message || data?.mensagem || data?.error || data?.erro || error?.message || "";
  const message = text(rawMessage);

  const mentionsLicense = [
    "licenca",
    "assinatura",
    "plano",
    "mensalidade",
    "subscription",
    "trial",
  ].some((word) => message.includes(word));
  const mentionsExpiration = EXPIRED_WORDS.some((word) => message.includes(word));

  if (mentionsLicense && mentionsExpiration) return LICENCA_VENCIDA_MSG;

  const mentionsRestaurantAccount = [
    "restaurante",
    "estabelecimento",
    "conta",
    "cadastro",
    "acesso",
  ].some((word) => message.includes(word));
  const mentionsBlockedState = BLOCKED_WORDS.some((word) => message.includes(word));

  if (mentionsRestaurantAccount && mentionsBlockedState) {
    return RESTAURANTE_BLOQUEADO_MSG;
  }

  const restaurante = pickRestauranteFromPayload(data);
  return getRestauranteAccessBlockMessage(restaurante);
}
