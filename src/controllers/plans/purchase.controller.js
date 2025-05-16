import PlanPurchase from "../../models/planPurchase.model.js";
import Plan from "../../models/plan.model.js";

const routes = {};

routes.purchasePlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const { selectedCycle } = req.body;
    
        // Get user ID from authenticated session (req.user) or req.body fallback
        const userId = req.user?._id || req.body.user;
    
        if (!userId || !selectedCycle) {
          return res.status(400).json({ message: "User and billing cycle are required" });
        }
    
        if (!['monthly', 'yearly'].includes(selectedCycle)) {
          return res.status(400).json({ message: "Invalid billing cycle" });
        }
    
        const plan = await Plan.findById(planId);
        if (!plan) {
          return res.status(404).json({ message: "Plan not found" });
        }
    
        const selectedPrice = plan.billingOptions[selectedCycle];
        if (!selectedPrice) {
          return res.status(400).json({ message: "Price not available for selected cycle" });
        }
    
        // Calculate endDate
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (selectedCycle === "monthly") {
          endDate.setMonth(endDate.getMonth() + 1);
        } else {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
    
        const newPurchase = new PlanPurchase({
          user: userId,
          plan: planId,
          selectedCycle,
          selectedPrice,
          startDate,
          endDate
        });
    
        await newPurchase.save();
    
        res.status(201).json({
          message: "Plan purchased successfully",
          data: newPurchase,
        });
      } catch (error) {
        console.error("Plan purchase error:", error);
        res.status(500).json({ message: "Server error" });
      }
}



export default routes;