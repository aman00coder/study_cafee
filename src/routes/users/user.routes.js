import express from "express"
import userController from "../../controllers/users/user.controller.js"
import upload from "../../middleware/multer.middleware.js"
import authMiddleware from "../../middleware/auth.middleware.js"

const router = express.Router()

router.post("/registerUser",upload.single("profilePhoto") ,userController.registerUser)
    //   .post("/sendOTP", userController.sendOTP)
      .post("/verifyOTP", userController.verifyOTP)
      .post("/loginUser", userController.loginUser)
      .post("/forget-Password", userController.forgotPassword)
      .patch("/reset-Password", userController.resetPassword)
      .patch("/updateUser",authMiddleware(["user"]), upload.single("profilePhoto"), userController.updateUserProfile)
      .get("/allDesignationn", userController.allDesignation)
      .get("/UserProfile",authMiddleware(["user"]), userController.getUserProfile)
      .get("/getBanner", userController.getBannerSet)
      .get("/allCategory", userController.getAllCategory)
      .get("/postersByCategory/:categoryId", userController.postersByCategory)
      .get("/postersById/:posterId", userController.postersById)
      .get("/allPlans", userController.allPlans)

export default router;