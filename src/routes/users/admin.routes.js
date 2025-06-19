import express from "express"
import authMiddleware from "../../middleware/auth.middleware.js"
import adminController from "../../controllers/users/admin.controller.js"
import upload from "../../middleware/multer.middleware.js"
import couponController from "../../controllers/plans/coupon.controller.js"
import { 
      getAllInvoices
    } from "../../controllers/plans/invoice.controller.js";

const router = express.Router()

router.post("/registerAdmin", adminController.registerAdmin)
      .post("/loginAdmin", adminController.loginAdmin)
      .post("/forget-Password", adminController.forgotPassword)
      .patch("/reset-Password", adminController.resetPassword)

      .get("/allCompany", authMiddleware(["admin"]), adminController.getAllCompanies)

      .get("/allUser", authMiddleware(["admin"]), adminController.getAllUser)

      .post("/add-Designation", authMiddleware(["admin"]), adminController.createDesignation)
      .delete("/delete-Designation/:id", authMiddleware(["admin"]), adminController.deleteDesignation)

      //Banner Routes
      .post("/add-Banner", authMiddleware(["admin"]), upload.array('image') , adminController.createBanner)
      .get("/all-Banner", authMiddleware(["admin"]), adminController.allBanner)
      .patch("/updateBannerStatus/:bannerId",authMiddleware(["admin"]), adminController.handleBannerStatus)
      .patch("/update-Banner", authMiddleware(["admin"]), upload.array('image') , adminController.updateBanner)
      .delete("/delete-Banner/:bannerId", authMiddleware(["admin"]), adminController.deleteBanner)

      //Category Routes
      .post("/createCategory", authMiddleware(["admin"]), adminController.createCategory)
      .get("/categoryColumn/:parentId", authMiddleware(["admin"]), adminController.getTableColumnsByParentId)
      .patch("/updateCategory/:id", authMiddleware(["admin"]), adminController.updateCategory)
      .get("/category/:id", authMiddleware(["admin"]), adminController.categoryById)
      .delete("/deleteCategory/:id", authMiddleware(["admin"]), adminController.deleteCategory)

      //Poster Routes
      .post("/addPoster", authMiddleware(["admin"]), upload.single('image'), adminController.addPosters)
      .get("/allPosters", authMiddleware(["admin"]), adminController.allPosters)
      .delete("/deletePoster/:posterId", authMiddleware(["admin"]), adminController.deletePoster)

      .post("/brandingPosters", authMiddleware(["admin"]), upload.array('image'), adminController.postersForBranding)
      .patch("/brandStatus/:posterId", authMiddleware(["admin"]), adminController.handleBrandingStatus)
      .get("/allBrandingPosters", authMiddleware(["admin"]), adminController.allBrandingPosters)
      .delete("/deleteBranding/:posterId", authMiddleware(["admin"]), adminController.deleteBrandingPoster)

      //Plan Routes
      .post("/createPlan", authMiddleware(["admin"]), adminController.createPlan)
      .get("/allPlan", adminController.allPlans)
      .get("/planById/:planId", authMiddleware(["admin","user"]), adminController.planById)
      .patch("/updatePlan/:planId", authMiddleware(["admin"]), adminController.updatePlan)
      .delete("/deletePlan/:planId", authMiddleware(["admin"]), adminController.deletePlan)

      //Plans Routes
      .post("/createCoupon", authMiddleware(["admin"]), couponController.createCoupon)
      .patch("/updateCoupon/:couponId", authMiddleware(["admin"]), couponController.updateCoupon)
      .get("/allCoupons", authMiddleware(["admin","user"]), couponController.allCoupons)
      .get("/validateCoupon/:code", authMiddleware(["user"]), couponController.validateCoupon)
      .get("/couponById/:couponId", authMiddleware(["admin"]), couponController.getCouponById)
      .delete("/deleteCoupon/:couponId", authMiddleware(["admin"]), couponController.deleteCoupon)
      

      //Review
      .get("/allTestimonial", adminController.allTestimonial)

      //Plan Purchase
      .get("/allPayment", authMiddleware(["admin"]), adminController.allPayment)
      .get("/allPurchase", authMiddleware(["admin"]), adminController.allPurchase)
      .get("/purchase/:purchaseId", authMiddleware(["admin"]), adminController.purchaseById)


      //Invoice
      .get("/allInvoices", authMiddleware(["admin"]), getAllInvoices)

      //Services Portion
      .post("/addServices", authMiddleware(["admin"]), upload.array("images"), adminController.addServices)
      .patch("/updateService/:id", authMiddleware(["admin"]), upload.array("files"), adminController.updateService)
      .get("/allServices", adminController.getAllService)
      .get("/serviceById/:id", authMiddleware(["admin"]), adminController.getServiceById)
      .delete("/deleteService/:id", authMiddleware(["admin"]), adminController.deleteService)

export default router;