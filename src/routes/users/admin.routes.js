import express from "express"
import authMiddleware from "../../middleware/auth.middleware.js"
import adminController from "../../controllers/users/admin.controller.js"
import upload from "../../middleware/multer.middleware.js"

const router = express.Router()

router.post("/registerAdmin", adminController.registerAdmin)
      .post("/loginAdmin", adminController.loginAdmin)
      .post("/add-Banner",authMiddleware(["admin"]), upload.array('image') ,adminController.createBanner)

export default router;