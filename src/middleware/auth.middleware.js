import jwt from "jsonwebtoken"

const authMiddleware = (roles)=>{
    return(req, res, next) => {
        try {
            const token = req.header("Authorization").replace("Bearer ","");

            if (!token) {
                return res
                  .status(401)
                  .json({ message: "Access denied. No token provided." });
              }

            const decoded = jwt.verify(token, `${process.env.JWT_SECRET}`)
            req.user = decoded

            console.log("Decode =",decoded)
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
    }
}

export default authMiddleware;