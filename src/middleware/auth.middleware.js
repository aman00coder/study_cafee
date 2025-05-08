import jwt from "jsonwebtoken";

const authMiddleware = (roles) => {
  return (req, res, next) => {
    // ✅ Allow preflight OPTIONS requests through
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.header("Authorization");
      if (!authHeader) {
        return res
          .status(401)
          .json({ message: "Access denied. No token provided." });
      }

      const token = authHeader.replace("Bearer ", "");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      if (!roles.includes(decoded.role)) {
        return res
          .status(403)
          .json({ message: "Access denied. Insufficient permissions." });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Invalid or expired token." });
    }
  };
};

export default authMiddleware;
