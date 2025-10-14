import express from "express"
import adminRoutes from "./users/admin.routes.js"
import userRoutes from "./users/user.routes.js"

const router = express.Router()

router.use("/admin", adminRoutes)
      .use("/user", userRoutes)
      .get("/check", (req,res)=>{
    res.send("Server Running again!")
})


export default router;     
