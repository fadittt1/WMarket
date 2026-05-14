import jwt from "jsonwebtoken";
import { User } from "../models/User.js";


export const requireAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ error: "Not authorized, user not found" });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

export const requireAdmin = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized as admin, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (user && user.role === "admin") {
      req.user = user;
      next();
    } else {
      return res.status(403).json({ error: "Not authorized as admin" });
    }
  } catch {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};
