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
const generateInvoicePDF = async (invoice, user, plan) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const tempFilePath = path.join(__dirname, `../../temp/invoice_${invoice.invoiceNumber}.pdf`);

      if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../../temp'));
      }

      const writeStream = fs.createWriteStream(tempFilePath);
      doc.pipe(writeStream);

      const company = await CompanyProfile.findOne({ userId: user._id });
      const invoiceDate = new Date(invoice.createdAt).toLocaleDateString();

      // Header
      doc.fontSize(20).text("Tax Invoice", { align: "center" });
      doc.moveDown(1);

      // Seller Info
      doc.fontSize(10).text("Studycafe Private Limited");
      doc.text("1003, Modi Tower 98, Nehruplace, Delhi 110019");
      doc.text("GSTIN/UIN: 07ABDCS9065J1ZV");
      doc.text("State Name: Delhi, Code: 07");
      doc.text("Email: contact@studycafe.in");
      doc.moveDown();

      // Buyer Info
      doc.font('Helvetica-Bold').text("Buyer (Bill to):").font('Helvetica');
      doc.text(`${company.companyName}`);
      doc.text(company.companyAddress);
      doc.text(`GSTIN/UIN: ${company.gstin || 'N/A'}`);
      doc.text("State Name: Maharashtra, Code: 27");
      doc.text(`Place of Supply: Maharashtra`);
      doc.moveDown();

      // Invoice Meta Info
      doc.text(`Invoice No.: ${invoice.invoiceNumber}`);
      doc.text(`Date: ${invoiceDate}`);
      doc.moveDown();

      // Table headers
      doc.font('Helvetica-Bold');
      doc.text("Sl", 50).text("Particulars", 80).text("HSN/SAC", 250)
         .text("Taxable Value", 320).text("IGST", 400).text("Amount", 470);
      doc.moveDown();

      // Table content
      const hsnCode = "9983";
      const taxRate = invoice.taxPercentage || 0;
      const taxableValue = invoice.basePrice;
      const taxAmt = invoice.taxAmount;
      const totalAmt = invoice.finalAmount;

      doc.font('Helvetica');
      doc.text("1", 50)
        .text(`${plan.name} (${invoice.selectedCycle})`, 80)
        .text(hsnCode, 250)
        .text(`₹${taxableValue.toFixed(2)}`, 320)
        .text(`₹${taxAmt.toFixed(2)} (${taxRate}%)`, 400)
        .text(`₹${totalAmt.toFixed(2)}`, 470);
      doc.moveDown(2);

      // Total Summary
      doc.text(`Total: ₹${totalAmt.toFixed(2)}`, { align: "right" });
      doc.text(`Amount in Words: INR ${numWords(totalAmt)} Only`, { align: "right" });
      doc.moveDown();

      // Tax Summary
      doc.text("HSN/SAC Summary", { underline: true });
      doc.text(`HSN/SAC: ${hsnCode}`);
      doc.text(`Taxable Value: ₹${taxableValue.toFixed(2)}`);
      doc.text(`Integrated Tax: ₹${taxAmt.toFixed(2)} (${taxRate}%)`);
      doc.text(`Total: ₹${totalAmt.toFixed(2)}`);
      doc.text(`Tax Amount in Words: INR ${numWords(taxAmt)} Only`);
      doc.moveDown();

      // Bank Details
      doc.text("Company's Bank Details", { underline: true });
      doc.text("Account Holder: Studycafe Private Limited");
      doc.text("Bank Name: ICICI Bank");
      doc.text("Account No.: 418005000915");
      doc.text("Branch & IFSC: NEHRUPLACE DELHI & ICIC0004180");

      // Footer
      doc.moveDown(2);
      doc.text("for Studycafe Private Limited", { align: "right" });
      doc.text("Authorised Signatory", { align: "right" });
      doc.text("This is a Computer Generated Invoice", { align: "center" });

      doc.end();
      writeStream.on('finish', () => resolve(tempFilePath));
      writeStream.on('error', reject);
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
      finalAmount: paymentOrder.amount / 100, // Convert from paise to rupees
      taxType: paymentOrder.taxType,
      taxPercentage: paymentOrder.taxPercentage,
      coupon: paymentOrder.appliedCoupon || null
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Generate PDF
    const pdfPath = await generateInvoicePDF(invoice, user, plan);
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