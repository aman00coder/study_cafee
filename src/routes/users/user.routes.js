import express from "express"
import userController from "../../controllers/users/user.controller.js"
import upload from "../../middleware/multer.middleware.js"
import authMiddleware from "../../middleware/auth.middleware.js"

const router = express.Router()

router.post("/registerUser",upload.single("profilePhoto") ,userController.registerUser)
    //   .post("/sendOTP", userController.sendOTP)
      .post("/verifyOTP", userController.verifyOTP)
      .post("/loginUser", userController.loginUser)
      .patch("/updateUser",authMiddleware(["user"]), upload.single("profilePhoto"), userController.updateUserProfile)
      .get("/UserProfile",authMiddleware(["user"]), userController.getUserProfile)
      .get("/getBanner", authMiddleware(["user"]), userController.getBannerSet)
      .get("/allCategory", authMiddleware(["user"]), userController.getAllCategory)

export default router;