import express from "express"
import authMiddleware from "../../middleware/auth.middleware.js"
import adminController from "../../controllers/users/admin.controller.js"
import upload from "../../middleware/multer.middleware.js"

const router = express.Router()

router.post("/registerAdmin", adminController.registerAdmin)
      .post("/loginAdmin", adminController.loginAdmin)
      .post("/forget-Password", adminController.forgotPassword)
      .post("/reset-Password", adminController.resetPassword)
      .post("/add-Banner",authMiddleware(["admin"]), upload.array('image') ,adminController.createBanner)
      .get("/all-Banner",authMiddleware(["admin"]), adminController.allBanner)
      .patch("/updateBannerStatus/:bannerId",authMiddleware(["admin"]),adminController.handleBannerStatus)
      .delete("/delete-Banner/:bannerId",authMiddleware(["admin"]),adminController.deleteBanner)
      .post("/createCategory",authMiddleware(["admin"]),adminController.createCategory)
      .patch("/updateCategory/:id",authMiddleware(["admin"]),adminController.updateCategory)
      .delete("/deleteCategory/:id",authMiddleware(["admin"]),adminController.deleteCategory)

export default router;