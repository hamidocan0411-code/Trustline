export type PaymentMethod =
  | "cash"
  | "iban"
  | "bank_transfer";

export const DEFAULT_PAYMENT_METHOD: PaymentMethod =
  "cash";

export const normalizePaymentMethod = (
  value: unknown
): PaymentMethod | null => {
  const normalized =
    typeof value === "string"
      ? value.trim().toLocaleLowerCase("tr-TR")
      : "";

  if (
    normalized === "cash" ||
    normalized === "nakit"
  ) {
    return "cash";
  }

  if (
    normalized === "iban" ||
    normalized === "bank_transfer" ||
    normalized === "havale" ||
    normalized === "havale / iban"
  ) {
    return "iban";
  }

  return null;
};

export const formatPaymentMethod = (
  value: unknown,
  legacyValue?: unknown
): "NAKİT" | "İBAN" | "Belirtilmemiş" => {
  const method =
    normalizePaymentMethod(value) ||
    normalizePaymentMethod(legacyValue);

  switch (method) {
    case "cash":
      return "NAKİT";
    case "iban":
      return "İBAN";
    default:
      return "Belirtilmemiş";
  }
};
