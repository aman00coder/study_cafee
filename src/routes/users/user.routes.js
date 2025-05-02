import express from "express"
import userController from "../../controllers/users/user.controller.js"

const router = express.Router()

router.post("/registerUser", userController.registerUser)
      .post("/sendOTP", userController.sendOTP)
      .post("/verifyOTP", userController.verifyOTP)
      .post("/loginUser", userController.loginUser)

export default router;