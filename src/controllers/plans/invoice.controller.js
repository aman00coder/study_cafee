import Invoice from "../../models/invoice.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import Plan from "../../models/plan.model.js";
import User from "../../models/user.model.js";
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
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const tempFilePath = path.join(__dirname, `../../temp/invoice_${invoice.invoiceNumber}.pdf`);
      
      // Ensure temp directory exists
      if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../../temp'));
      }

      const writeStream = fs.createWriteStream(tempFilePath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // From - To sections
      doc.fontSize(12).text('From:', { continued: true }).font('Helvetica-Bold').text(' Study Cafe');
      doc.font('Helvetica').text('support@studycafe.com');
      doc.moveDown();

      doc.fontSize(12).text('To:', { continued: true }).font('Helvetica-Bold').text(` ${user.firstName} ${user.lastName}`);
      doc.font('Helvetica').text(user.email);
      doc.moveDown();

      // Invoice details
      doc.fontSize(12).text(`Plan: ${plan.name} (${invoice.selectedCycle} subscription)`);
      doc.moveDown();

      // Table header
      doc.font('Helvetica-Bold');
      doc.text('Description', 50, doc.y);
      doc.text('Unit Price', 300, doc.y, { width: 100, align: 'right' });
      doc.text('Amount', 400, doc.y, { width: 100, align: 'right' });
      doc.moveDown();

      // Table row
      doc.font('Helvetica');
      doc.text(plan.name, 50, doc.y);
      doc.text(`₹${invoice.basePrice.toFixed(2)}`, 300, doc.y, { width: 100, align: 'right' });
      doc.text(`₹${invoice.basePrice.toFixed(2)}`, 400, doc.y, { width: 100, align: 'right' });
      doc.moveDown();

      // Summary
      doc.moveDown();
      doc.text(`Subtotal: ₹${invoice.basePrice.toFixed(2)}`, { align: 'right' });
      if (invoice.discount > 0) {
        doc.text(`Discount: -₹${invoice.discount.toFixed(2)}`, { align: 'right' });
      }
      if (invoice.taxAmount > 0) {
        doc.text(`Tax (${invoice.taxPercentage}% ${invoice.taxType}): ₹${invoice.taxAmount.toFixed(2)}`, { align: 'right' });
      }
      doc.font('Helvetica-Bold').text(`Total: ₹${invoice.finalAmount.toFixed(2)}`, { align: 'right' });
      doc.moveDown(2);

      // Footer
      doc.font('Helvetica').text('Thank you for your business!', { align: 'center' });
      doc.text('Terms: Payment due upon receipt. Late payments may be subject to fees.', { align: 'center' });

      doc.end();

      writeStream.on('finish', () => resolve(tempFilePath));
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
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