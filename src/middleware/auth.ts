import jwt from "jsonwebtoken";

export async function checkAuth(req, res, next): Promise<void> {
  const token = req.headers["authorization"];
  if (token != null) {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    if (decoded != null) {
      req.userId = decoded;
      next();
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  } else {
    res.status(401).json({ error: "Missing token" });
  }
}

export async function issueJwt(userId: string): Promise<string> {
  return await jwt.sign(userId, process.env.JWT_SECRET);
}