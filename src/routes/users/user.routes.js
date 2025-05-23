import express from "express"
import userController from "../../controllers/users/user.controller.js"
import upload from "../../middleware/multer.middleware.js"
import purchaseController from "../../controllers/plans/purchase.controller.js"
import { 
      getInvoice, 
      getUserInvoices
    } from "../../controllers/plans/invoice.controller.js";

import authMiddleware from "../../middleware/auth.middleware.js"

const router = express.Router()

router.post("/registerUser",upload.single("profilePhoto") ,userController.registerUser)
    //   .post("/sendOTP", userController.sendOTP)
      .post("/verifyOTP", userController.verifyOTP)
      .post("/loginUser", userController.loginUser)
      .post("/forget-Password", userController.forgotPassword)
      .patch("/reset-Password", userController.resetPassword)

      //Comapnay Routes
      .post("/add-company",authMiddleware(["user"]), upload.single('companyLogo'),userController.addCompany)
      .get("/comapnyById/:id",authMiddleware(["user","admin"]), userController.getCompanyById)
      .get("/comapnyByUser/:userId",authMiddleware(["user","admin"]), userController.getCompanyByUserId)

      .patch("/updateUser",authMiddleware(["user"]), upload.single("profilePhoto"), userController.updateUserProfile)
      .get("/allDesignation", userController.allDesignation)
      .get("/UserProfile",authMiddleware(["user"]), userController.getUserProfile)
      .get("/getBanner", userController.getBannerSet)

      //Branding Routes
      .get("/getBrandingPosters", userController.getBrandingSet)
      .get("/allCategory", userController.getAllCategory)
      .get("/postersByCategory/:categoryId", userController.postersByCategory)
      .get("/postersById/:posterId", userController.postersById)
      .get("/allPlans", userController.allPlans)

      //Review
      .post("/addReview", authMiddleware(["user"]), userController.addTestimonoal)
      .get("/reviewById/:id", authMiddleware(["user"]), userController.getTestimonialById)
      .patch("/updateReview/:testimonialId", authMiddleware(["user"]), userController.updateTestimonial)
      .delete("/deleteReview/:testimonialId", authMiddleware(["user"]), userController.deleteTestimonial)

      //DownloadPosers
      .post("/downloadPoster/:posterId", authMiddleware(["user"]), userController.downloadPoster)

      //Plan Purchase
      .post("/payment/create-order", authMiddleware(["user"]), purchaseController.createOrder)
      .post("/payment/purchasePlan", authMiddleware(["user"]), purchaseController.purchasePlan)
      .get("/purchases", authMiddleware(["user"]), purchaseController.userPurchases)

            //Invoices
       // Get all invoices for logged-in user
       .get("/allInvoices", authMiddleware(["user"]), getUserInvoices)
       .get("/invoice/:id", authMiddleware(["admin","user"]), getInvoice)

export default router;