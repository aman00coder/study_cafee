import express from "express"
import adminController from "../../controllers/users/admin.controller.js"

const router = express.Router()

router.post("/registerAdmin", adminController.registerAdmin)
      .post("/loginAdmin", adminController.loginAdmin)

export default router;