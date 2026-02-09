export const normalizePhoneForE164 = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    const normalized = `+${digits}`;
    return normalized.length >= 10 && normalized.length <= 16 ? normalized : "";
  }

  if (digits.length === 8) {
    return `+976${digits}`;
  }

  if (digits.length >= 9 && digits.length <= 15) {
    return `+${digits}`;
  }

  return "";
};

export const isValidPhoneInput = (value: string): boolean => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

