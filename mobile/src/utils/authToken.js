export const parseTokenExpiryMs = (token) => {
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalizedPayload.length % 4)) % 4);
    const payload = JSON.parse(atob(`${normalizedPayload}${padding}`));
    if (!payload?.exp || typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch (_) {
    return null;
  }
};

export const isTokenExpired = (token, skewSeconds = 30) => {
  const expMs = parseTokenExpiryMs(token);
  if (!expMs) return true;
  return Date.now() >= expMs - skewSeconds * 1000;
};
