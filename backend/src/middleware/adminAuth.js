export function requireAdmin(req, res, next) {
  const header = req.headers["x-admin-password"];
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not configured on the server" });
  }

  if (!header || header !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

