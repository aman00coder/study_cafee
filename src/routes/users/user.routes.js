import express from "express"
import userController from "../../controllers/users/user.controller.js"
import upload from "../../middleware/multer.middleware.js"
import purchaseController from "../../controllers/plans/purchase.controller.js"

import authMiddleware from "../../middleware/auth.middleware.js"

const router = express.Router()

router.post("/registerUser",upload.single("profilePhoto") ,userController.registerUser)
    //   .post("/sendOTP", userController.sendOTP)
      .post("/verifyOTP", userController.verifyOTP)
      .post("/loginUser", userController.loginUser)
      .post("/forget-Password", userController.forgotPassword)
      .patch("/reset-Password", userController.resetPassword)
      .patch("/updateUser",authMiddleware(["user"]), upload.single("profilePhoto"), userController.updateUserProfile)
      .get("/allDesignation", userController.allDesignation)
      .get("/UserProfile",authMiddleware(["user"]), userController.getUserProfile)
      .get("/getBanner", userController.getBannerSet)
      .get("/allCategory", userController.getAllCategory)
      .get("/postersByCategory/:categoryId", userController.postersByCategory)
      .get("/postersById/:posterId", userController.postersById)
      .get("/allPlans", userController.allPlans)

      //Review
      .post("/addReview", authMiddleware(["user"]), userController.addTestimonoal)
      .patch("/updateReview/:testimonialId", authMiddleware(["user"]), userController.updateTestimonial)
      .delete("/deleteReview/:testimonialId", authMiddleware(["user"]), userController.deleteTestimonial)

      //DownloadPosers
      .post("/downloadPoster/:posterId", authMiddleware(["user"]), userController.downloadPoster)

      //Plan Purchase
      .post("/purchasePlan/:planId", authMiddleware(["user"]), purchaseController.purchasePlan)

export default router;