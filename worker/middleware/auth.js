// Admin authentication middleware

export async function authenticateAdmin(c, next) {
  const providedPassword = c.req.header('x-admin-password');

  if (!providedPassword) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Verify password using timing-safe comparison
  const expectedHash = c.env.ADMIN_PASSWORD_HASH;
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    console.error('ADMIN_PASSWORD_HASH is missing or invalid');
    return c.json({ error: 'Admin authentication is not configured' }, 503);
  }
  const encoder = new TextEncoder();
  const providedData = encoder.encode(providedPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', providedData);
  // Convert to hex string to match sha256sum output format
  const providedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!timingSafeEqual(providedHash, expectedHash)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  return crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b));
}