import Invoice from "../../models/invoice.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import Plan from "../../models/plan.model.js";
import User from "../../models/user.model.js";
import CompanyProfile from "../../models/companyProfile.js";
import { uploadToCloudinary } from "../../services/cloudinary.js"
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate invoice number
const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}${month}-${randomNum}`;
};

// Helper function to generate PDF invoice
export const generateInvoicePDF = (invoice, user, plan, company) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const tempDir = path.join(__dirname, '../../temp');
      const tempFilePath = path.join(tempDir, `invoice_${invoice.invoiceNumber}.pdf`);

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const writeStream = fs.createWriteStream(tempFilePath);
      doc.pipe(writeStream);

      const invoiceDate = new Date(invoice.createdAt).toLocaleDateString();
      const hsnCode = "9983";
      const taxableValue = invoice.basePrice;
      const taxAmount = invoice.taxAmount;
      const totalAmount = invoice.finalAmount;
      const taxRate = invoice.taxPercentage || 0;

      // Header
      doc.fontSize(16).text("Tax Invoice", { align: "center" }).moveDown();

      // From (Seller)
      doc.fontSize(10).text("Studycafe Private Limited");
      doc.text("1003, Modi Tower 98, Nehruplace, Delhi 110019");
      doc.text("GSTIN/UIN: 07ABDCS9065J1ZV");
      doc.text("State Name: Delhi, Code: 07");
      doc.text("E-Mail: contact@studycafe.in").moveDown();

      // To (Buyer)
      doc.font('Helvetica-Bold').text("Consignee (Ship to)").font('Helvetica');
      doc.text(company.companyName);
      doc.text(company.companyAddress);
      doc.text(`GSTIN/UIN: ${company.gstin || 'N/A'}`);
      doc.text("State Name: Maharashtra, Code: 27").moveDown();

      doc.font('Helvetica-Bold').text("Buyer (Bill to)").font('Helvetica');
      doc.text(company.companyName);
      doc.text(company.companyAddress);
      doc.text(`GSTIN/UIN: ${company.gstin || 'N/A'}`);
      doc.text("State Name: Maharashtra, Code: 27");
      doc.text("Place of Supply: Maharashtra").moveDown();

      // Invoice Details
      doc.text(`Invoice No.: ${invoice.invoiceNumber}`);
      doc.text(`Date: ${invoiceDate}`).moveDown();

      // Table Headers
      doc.font('Helvetica-Bold');
      doc.text("Sl", 50).text("Particulars", 80).text("HSN/SAC", 250)
        .text("Amount", 350, { width: 100, align: "right" });
      doc.moveDown();

      // Table Item
      doc.font('Helvetica');
      doc.text("1", 50)
        .text(`${plan.name} (${invoice.selectedCycle} subscription)`, 80)
        .text(hsnCode, 250)
        .text(`₹${taxableValue.toFixed(2)}`, 350, { width: 100, align: "right" });
      doc.moveDown();

      // Tax row
      doc.text("IGST Outward", 250).text(`₹${taxAmount.toFixed(2)}`, 350, { width: 100, align: "right" }).moveDown();

      // Total
      doc.font('Helvetica-Bold').text(`Total ₹${totalAmount.toFixed(2)}`, { align: "right" });
      doc.moveDown();

      // Amount in words
      doc.font('Helvetica').text(`Amount Chargeable (in words):`, { align: "left" });
      doc.font('Helvetica-Bold').text(`INR ${numWords(totalAmount)} Only`).moveDown();

      // Tax Summary
      doc.font('Helvetica-Bold').text("HSN/SAC Summary").moveDown(0.5);
      doc.font('Helvetica').text(`HSN/SAC: ${hsnCode}`);
      doc.text(`Taxable Value: ₹${taxableValue.toFixed(2)}`);
      doc.text(`Integrated Tax: ₹${taxAmount.toFixed(2)} @ ${taxRate}%`);
      doc.text(`Total: ₹${totalAmount.toFixed(2)}`);
      doc.text(`Tax Amount in Words: INR ${numWords(taxAmount)} Only`).moveDown();

      // PAN
      doc.text(`Company's PAN: ABDCS9065J`).moveDown();

      // Bank Details
      doc.font('Helvetica-Bold').text("Company's Bank Details").font('Helvetica');
      doc.text("Account Holder: Studycafe Private Limited");
      doc.text("Bank Name: ICICI BANK");
      doc.text("Account No.: 418005000915");
      doc.text("Branch & IFSC: NEHRUPLACE DELHI & ICIC0004180").moveDown(2);

      // Footer
      doc.text("for Studycafe Private Limited", { align: "right" });
      doc.text("Authorised Signatory", { align: "right" });
      doc.moveDown();
      doc.fontSize(9).text("This is a Computer Generated Invoice", { align: "center" });

      doc.end();
      writeStream.on("finish", () => resolve(tempFilePath));
      writeStream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};

// Create invoice from payment order (to be called after successful payment)
export const createInvoiceFromPaymentOrder = async (paymentOrderId) => {
  try {
    const paymentOrder = await PaymentOrder.findById(paymentOrderId)
      .populate('plan')
      .populate('user');

    if (!paymentOrder) {
      throw new Error('Payment order not found');
    }

    const plan = await Plan.findById(paymentOrder.plan);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const user = await User.findById(paymentOrder.user);
    if (!user) {
      throw new Error('User not found');
    }

    const company = await CompanyProfile.findOne({ userId: user._id });
if (!company) {
  throw new Error('Company profile not found for user');
}

    // Check if invoice already exists for this payment order
    const existingInvoice = await Invoice.findOne({ paymentOrder: paymentOrderId });
    if (existingInvoice) {
      return existingInvoice;
    }

const invoiceData = {
  user: paymentOrder.user,
  plan: paymentOrder.plan,
  paymentOrder: paymentOrder._id,
  invoiceNumber: generateInvoiceNumber(),
  selectedCycle: paymentOrder.selectedCycle,
  basePrice: paymentOrder.selectedPrice,
  discount: paymentOrder.discount || 0,
  taxAmount: paymentOrder.taxAmount || 0,
  finalAmount: paymentOrder.amount / 100,
  taxType: paymentOrder.taxType,
  taxPercentage: paymentOrder.taxPercentage,
  coupon: paymentOrder.appliedCoupon || null
};

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Generate PDF
    const pdfPath = await generateInvoicePDF(invoice, user, plan, company);
    const uploadResult = await uploadToCloudinary(pdfPath, 'invoices');
    
    // Update invoice with PDF URL
    invoice.invoiceUrl = uploadResult.secure_url;
    invoice.publicId = uploadResult.public_id;
    await invoice.save();

    // Clean up temp file
    fs.unlinkSync(pdfPath);

    return invoice;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

// Get invoice by ID
export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('plan', 'name')
      .populate('paymentOrder');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Verify the requesting user owns the invoice or is admin
    if (req.user._id.toString() !== invoice.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to access this invoice' });
    }

    res.status(200).json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all invoices for a user
export const getUserInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('plan', 'name')
      .populate('paymentOrder');

    res.status(200).json({ invoices });
  } catch (error) {
    console.error('Get user invoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin - Get all invoices
export const getAllInvoices = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { page = 1, limit = 20, userId } = req.query;
    const query = {};
    
    if (userId) {
      query.user = userId;
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName email')
      .populate('plan', 'name')
      .populate('paymentOrder');

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      invoices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};