import crypto from "crypto";

const testOrderId = "order_QZV5CGsiBbFwSc";
const testPaymentId = "pay_29QQoUBi66xm4f";
const secret = "yhg29G6s5L7OcCrRm3eZhkHN";

const testSignature = crypto
  .createHmac("sha256", secret)
  .update(`${testOrderId}|${testPaymentId}`)
  .digest("hex");

console.log("Test signature:", testSignature);
