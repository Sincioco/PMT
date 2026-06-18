export function normalizeSavedArray(value, legacyValue = "") {
  if (Array.isArray(value)) {
    return value.filter(item => item !== null && item !== undefined && item !== "").map(String);
  }

  if (legacyValue !== null && legacyValue !== undefined && legacyValue !== "") {
    return [String(legacyValue)];
  }

  if (value !== null && value !== undefined && value !== "") {
    return [String(value)];
  }

  return [];
}
