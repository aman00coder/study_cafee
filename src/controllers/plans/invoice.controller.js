import Invoice from "../../models/invoice.model.js";
import PaymentOrder from "../../models/paymentOrder.model.js";
import Plan from "../../models/plan.model.js";
import User from "../../models/user.model.js";
import Coupon from "../../models/coupon.model.js";
import CompanyProfile from "../../models/companyProfile.js"
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

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount).replace('₹', '₹ ');
};

// Updated helper function to generate PDF invoice
const generateInvoicePDF = async (invoice, user, plan, companyProfile) => {
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

      // Set up colors
      const primaryColor = '#3498db';
      const secondaryColor = '#2c3e50';
      const lightColor = '#f8f9fa';
      const darkColor = '#343a40';

      // Add header with logo and company info
      doc.fillColor(secondaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text("Studycafe Private Limited", 50, 50);
      
      doc.fontSize(10)
         .text(" 1003, Modi Tower 98, Nehruplace, Delhi 110019", 50, 70)
         .text(' GSTIN/UIN: 07ABDCS9065J1ZV | Email: contact@studycafe.in', 50, 85)
         .text("Website: https://study-cafe-ymuj.onrender.com/", 50, 100);

      // Add invoice title and details
      doc.fontSize(20)
         .fillColor(primaryColor)
         .text('INVOICE', 400, 50, { align: 'right' });
      
      doc.fontSize(10)
         .fillColor(darkColor)
         .text(`Invoice #: ${invoice.invoiceNumber}`, 400, 80, { align: 'right' })
         .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, 400, 95, { align: 'right' })

      // Add bill to section
      doc.moveDown(3);
      doc.fontSize(12)
         .fillColor(secondaryColor)
         .font('Helvetica-Bold')
         .text('BILL TO:', 50, 150);
      
      doc.rect(50, 165, 250, 80).stroke('#e0e0e0');
      doc.font('Helvetica')
         .fillColor(darkColor)
         .text(companyProfile.companyName, 60, 170)
         .text(companyProfile.name, 60, 185)
         .text(companyProfile.companyAddress, 60, 200)
         .text(`Phone: ${companyProfile.companyPhoneNumber}`, 60, 215)
         .text(`Email: ${companyProfile.companyEmail}`, 60, 230);

      // Add invoice items table
      doc.moveDown(5);
      const tableTop = 280;
      
      // Table header
      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor(lightColor);
      doc.rect(50, tableTop, 500, 20).fill(secondaryColor);
      doc.text('Description', 60, tableTop + 5)
         .text('Qty', 350, tableTop + 5, { width: 50, align: 'center' })
         .text('Unit Price', 400, tableTop + 5, { width: 75, align: 'right' })
         .text('Amount', 475, tableTop + 5, { width: 75, align: 'right' });

      // Table row
      doc.font('Helvetica')
         .fillColor(darkColor)
         .text(plan.name, 60, tableTop + 30)
         .text('1', 350, tableTop + 30, { width: 50, align: 'center' })
         .text(formatCurrency(invoice.basePrice), 400, tableTop + 30, { width: 75, align: 'right' })
         .text(formatCurrency(invoice.basePrice), 475, tableTop + 30, { width: 75, align: 'right' });

      // Add summary section
      const summaryTop = tableTop + 80;
      doc.fontSize(10)
         .text('Subtotal:', 400, summaryTop, { width: 75, align: 'right' })
         .text(formatCurrency(invoice.basePrice), 475, summaryTop, { width: 75, align: 'right' });
      
      if (invoice.discount > 0) {
        doc.text('Discount:', 400, summaryTop + 20, { width: 75, align: 'right' })
           .text(`-${formatCurrency(invoice.discount)}`, 475, summaryTop + 20, { width: 75, align: 'right' });
      }
      
      if (invoice.taxAmount > 0) {
        doc.text(`Tax (${invoice.taxPercentage}% ${invoice.taxType}):`, 400, summaryTop + 40, { width: 75, align: 'right' })
           .text(formatCurrency(invoice.taxAmount), 475, summaryTop + 40, { width: 75, align: 'right' });
      }
      
      doc.rect(400, summaryTop + 60, 150, 1).fill('#cccccc');
      
      doc.font('Helvetica-Bold')
         .text('Total Amount:', 400, summaryTop + 70, { width: 75, align: 'right' })
         .text(formatCurrency(invoice.finalAmount), 475, summaryTop + 70, { width: 75, align: 'right' });

      // Add payment information
      doc.moveDown(6);
      doc.font('Helvetica-Bold')
         .fillColor(secondaryColor)
         .text('PAYMENT INFORMATION', 50, doc.y);
      
      doc.rect(50, doc.y + 5, 500, 1).fill(primaryColor);
      
      doc.font('Helvetica')
         .fillColor(darkColor)
         .text(`Payment Method: ${invoice.paymentOrder?.paymentMethod || 'Online Payment'}`, 50, doc.y + 15)
         .text(`Payment Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, 50, doc.y + 30)
         .text(`Transaction ID: ${invoice.paymentOrder?.razorpayPaymentId || 'N/A'}`, 50, doc.y + 45);

      // Add terms and conditions
      doc.moveDown(3);
      // doc.font('Helvetica-Bold')
      //    .fillColor(secondaryColor)
      //    .text('TERMS & CONDITIONS', 50, doc.y);
      
      // doc.rect(50, doc.y + 5, 500, 1).fill(primaryColor);
      
      // doc.font('Helvetica')
      //    .fontSize(9)
      //    .fillColor(darkColor)
      //    .text('1. Payment is due within 7 days of invoice date.', 50, doc.y + 15)
      //    .text('2. Please include the invoice number in your payment reference.', 50, doc.y + 30)
      //    .text('3. Late payments are subject to a 1.5% monthly interest charge.', 50, doc.y + 45)
      //    .text('4. All amounts are in Indian Rupees (INR).', 50, doc.y + 60);

      // // Add footer
      // doc.moveDown(4);
      doc.font('Helvetica-Oblique')
         .fontSize(10)
         .fillColor(primaryColor)
         .text('Thank you for your business!', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.font('Helvetica')
         .fontSize(8)
         .fillColor('#777777')
         .text(companyProfile.companyName, { align: 'center' });

      // Add page border
      doc.rect(30, 30, 540, 800).stroke('#f0f0f0');

      doc.end();

      writeStream.on('finish', () => resolve(tempFilePath));
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// Updated createInvoiceFromPaymentOrder function
export const createInvoiceFromPaymentOrder = async (paymentOrderId) => {
  try {
    const paymentOrder = await PaymentOrder.findById(paymentOrderId)
      .populate('plan')
      .populate('user');

    if (!paymentOrder) throw new Error('Payment order not found');
    const { plan, user } = paymentOrder;

    // Get company profile
    const companyProfile = await CompanyProfile.findOne({ userId: paymentOrder.user });
    if (!companyProfile) throw new Error('Company profile not found');

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ paymentOrder: paymentOrderId });
    if (existingInvoice) return existingInvoice;

    const basePrice = paymentOrder.selectedPrice;

    // Handle discount from coupon
    let discount = 0;
    let appliedCoupon = null;
    if (paymentOrder.appliedCoupon) {
      const coupon = await Coupon.findOne({ code: paymentOrder.appliedCoupon, isActive: true });
      if (coupon) {
        appliedCoupon = coupon.code;
        if (coupon.discountType === 'flat') {
          discount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
          discount = (basePrice * coupon.discountValue) / 100;
        }
        // Ensure discount doesn't exceed base price
        discount = Math.min(discount, basePrice);
      }
    }

    // Get tax info from plan
    const taxType = plan.taxType || 'inclusive';
    const taxPercentage = plan.taxPercentage || 0;

    let taxableAmount = basePrice - discount;
    let taxAmount = 0;
    let finalAmount = 0;

    if (taxType === 'exclusive') {
      taxAmount = (taxableAmount * taxPercentage) / 100;
      finalAmount = taxableAmount + taxAmount;
    } else {
      // Inclusive tax: finalAmount already includes tax
      finalAmount = taxableAmount;
      taxAmount = (finalAmount * taxPercentage) / (100 + taxPercentage);
    }

    const invoiceData = {
      user: paymentOrder.user,
      plan: paymentOrder.plan,
      paymentOrder: paymentOrder._id,
      invoiceNumber: generateInvoiceNumber(),
      selectedCycle: paymentOrder.selectedCycle,
      basePrice,
      discount,
      taxAmount,
      finalAmount,
      taxType,
      taxPercentage,
      coupon: appliedCoupon
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    // Generate PDF with full details
    const pdfPath = await generateInvoicePDF(invoice.toObject(), user, plan, companyProfile);
    const uploadResult = await uploadToCloudinary(pdfPath, 'invoices');

    invoice.invoiceUrl = uploadResult.secure_url;
    invoice.publicId = uploadResult.public_id;
    await invoice.save();

    fs.unlinkSync(pdfPath); // Clean up temp PDF file

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
    if (req.user.role !== 'admin') {
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


// Temporary test code - remove after testing
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    const testInvoice = {
      invoiceNumber: generateInvoiceNumber(),
      createdAt: new Date(),
      basePrice: 100,
      discount: 100,
      taxAmount: 180,
      finalAmount: 1079,
      taxPercentage: 18,
      taxType: "GST",
      selectedCycle: "Monthly",
      paymentOrder: { razorpayPaymentId: "pay_test123" }
    };
    
    const testUser = {
      _id: "test_user_id", // Add this
      firstName: "Test",
      lastName: "User",
      email: "test@example.com"
    };
    
    const testPlan = {
      name: "Test Plan"
    };

    // Add test company profile
    const testCompanyProfile = {
      companyName: "Test Company",
      name: "Test Contact",
      companyAddress: "123 Test St, Test City",
      companyPhoneNumber: "+911234567890",
      companyEmail: "test@company.com",
      companyWebsite: "www.testcompany.com",
      userId: testUser._id
    };
    
    console.log("Generating test PDF...");
    const path = await generateInvoicePDF(testInvoice, testUser, testPlan, testCompanyProfile);
    console.log(`Test PDF generated at: ${path}`);
  })();
}