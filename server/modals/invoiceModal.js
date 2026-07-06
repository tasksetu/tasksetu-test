import mongoose from 'mongoose';

/**
 * Invoice Schema
 * Stores payment/invoice history for organizations and individual users
 * Supports billing history, download invoices, and payment tracking
 */
const invoiceSchema = new mongoose.Schema(
  {
    // Invoice identification
    invoice_number: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Billing entity (either organization or individual user)
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    account_type: {
      type: String,
      required: true,
      enum: ['individual', 'company'],
      default: 'company',
    },

    // License and subscription details
    license_code: {
      type: String,
      required: true,
      uppercase: true,
      ref: 'License',
    },
    subscription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrganizationSubscription',
      required: false,
    },

    // Billing period
    billing_cycle: {
      type: String,
      required: true,
      enum: ['MONTHLY', 'YEARLY'],
      default: 'MONTHLY',
    },
    billing_period_start: {
      type: Date,
      required: true,
    },
    billing_period_end: {
      type: Date,
      required: true,
    },

    // Amount details
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount_code: {
      type: String,
      default: null,
    },
    discount_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    tax_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax_percentage: {
      type: Number,
      default: 18, // Default GST 18%
      min: 0,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR'],
    },

    // Seats information
    seats_purchased: {
      type: Number,
      default: 1,
      min: 1,
    },
    price_per_seat: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Payment details
    payment_status: {
      type: String,
      required: true,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    payment_method: {
      type: String,
      enum: ['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI', 'WALLET', 'PAYPAL', 'RAZORPAY', 'STRIPE', 'BANK_TRANSFER', 'INVOICE', 'NONE'],
      default: 'NONE',
    },
    payment_gateway: {
      type: String,
      enum: ['razorpay', 'stripe', 'paypal', 'manual', 'none'],
      default: 'none',
    },
    transaction_id: {
      type: String,
      default: null,
      index: true,
    },
    gateway_order_id: {
      type: String,
      default: null,
    },
    gateway_payment_id: {
      type: String,
      default: null,
    },
    payment_date: {
      type: Date,
      default: null,
    },
    payment_card_last4: {
      type: String,
      default: null,
    },

    // Invoice type
    invoice_type: {
      type: String,
      required: true,
      enum: ['subscription', 'upgrade', 'downgrade', 'renewal', 'additional_seats', 'refund'],
      default: 'subscription',
    },

    // Billing contact information
    billing_name: {
      type: String,
      required: true,
    },
    billing_email: {
      type: String,
      required: true,
    },
    billing_address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postal_code: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },
    billing_gstin: {
      type: String,
      default: null,
    },
    billing_pan: {
      type: String,
      default: null,
    },

    // Metadata
    notes: {
      type: String,
      default: null,
    },
    internal_notes: {
      type: String,
      default: null,
    },

    // PDF storage (URL or base64)
    pdf_url: {
      type: String,
      default: null,
    },
    pdf_generated_at: {
      type: Date,
      default: null,
    },

    // Refund details (if applicable)
    refund_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refund_date: {
      type: Date,
      default: null,
    },
    refund_reason: {
      type: String,
      default: null,
    },
    refund_transaction_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Indexes for performance
invoiceSchema.index({ organization_id: 1, created_at: -1 });
invoiceSchema.index({ user_id: 1, created_at: -1 });
invoiceSchema.index({ payment_status: 1, created_at: -1 });
invoiceSchema.index({ invoice_type: 1, created_at: -1 });
invoiceSchema.index({ billing_period_start: 1, billing_period_end: 1 });

// Pre-save hook to generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoice_number) {
    // Use Asia/Kolkata timezone for business-consistent invoice numbering
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year').value);
    const month = parts.find(p => p.type === 'month').value;
    const monthNum = parseInt(month) - 1;

    // Get count of invoices this month (using UTC boundaries for IST month)
    const monthStart = new Date(Date.UTC(year, monthNum, 1) - 5.5 * 60 * 60 * 1000); // IST offset
    const monthEnd = new Date(Date.UTC(year, monthNum + 1, 1) - 5.5 * 60 * 60 * 1000);

    const count = await this.constructor.countDocuments({
      created_at: {
        $gte: monthStart,
        $lt: monthEnd,
      },
    });

    this.invoice_number = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Methods
invoiceSchema.methods.markAsPaid = async function (transactionId, paymentMethod, cardLast4 = null) {
  this.payment_status = 'paid';
  this.transaction_id = transactionId;
  this.payment_method = paymentMethod;
  this.payment_date = new Date();
  if (cardLast4) {
    this.payment_card_last4 = cardLast4;
  }
  return this.save();
};

invoiceSchema.methods.markAsFailed = async function (reason = null) {
  this.payment_status = 'failed';
  if (reason) {
    this.internal_notes = reason;
  }
  return this.save();
};

invoiceSchema.methods.processRefund = async function (amount, reason, transactionId) {
  this.payment_status = 'refunded';
  this.refund_amount = amount;
  this.refund_date = new Date();
  this.refund_reason = reason;
  this.refund_transaction_id = transactionId;
  return this.save();
};

invoiceSchema.methods.getFormattedAmount = function () {
  const currencySymbol = {
    INR: '₹',
    USD: '$',
    EUR: '€',
  };
  return `${currencySymbol[this.currency] || '₹'}${this.total_amount.toFixed(2)}`;
};

// Statics
invoiceSchema.statics.generateInvoiceNumber = async function () {
  // Use Asia/Kolkata timezone for business-consistent invoice numbering
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parts.find(p => p.type === 'month').value;
  const monthNum = parseInt(month) - 1;

  const monthStart = new Date(Date.UTC(year, monthNum, 1) - 5.5 * 60 * 60 * 1000);
  const monthEnd = new Date(Date.UTC(year, monthNum + 1, 1) - 5.5 * 60 * 60 * 1000);

  const count = await this.countDocuments({
    created_at: {
      $gte: monthStart,
      $lt: monthEnd,
    },
  });

  return `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
};

invoiceSchema.statics.getOrganizationInvoices = async function (organizationId, options = {}) {
  const { page = 1, limit = 10, status = null, sortBy = 'created_at', sortOrder = -1 } = options;

  const query = { organization_id: organizationId };
  if (status) {
    query.payment_status = status;
  }

  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    this.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

invoiceSchema.statics.getUserInvoices = async function (userId, options = {}) {
  const { page = 1, limit = 10, status = null, sortBy = 'created_at', sortOrder = -1 } = options;

  const query = { user_id: userId, account_type: 'individual' };
  if (status) {
    query.payment_status = status;
  }

  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    this.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

invoiceSchema.statics.createSubscriptionInvoice = async function (data) {
  const {
    organizationId,
    userId,
    accountType,
    licenseCode,
    subscriptionId,
    billingCycle,
    seats,
    pricePerSeat,
    discountCode,
    discountPercentage,
    billingName,
    billingEmail,
    billingAddress,
    billingGstin,
    invoiceType = 'subscription',
  } = data;

  const subtotal = seats * pricePerSeat * (billingCycle === 'YEARLY' ? 12 : 1);
  const discountAmount = discountPercentage > 0 ? (subtotal * discountPercentage) / 100 : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * 18) / 100; // 18% GST
  const totalAmount = taxableAmount + taxAmount;

  const periodStart = new Date();
  const periodEnd = new Date();
  if (billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  return this.create({
    organization_id: accountType === 'company' ? organizationId : undefined,
    user_id: accountType === 'individual' ? userId : undefined,
    account_type: accountType,
    license_code: licenseCode,
    subscription_id: subscriptionId,
    billing_cycle: billingCycle,
    billing_period_start: periodStart,
    billing_period_end: periodEnd,
    subtotal,
    discount_amount: discountAmount,
    discount_code: discountCode,
    discount_percentage: discountPercentage || 0,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    seats_purchased: seats,
    price_per_seat: pricePerSeat,
    billing_name: billingName,
    billing_email: billingEmail,
    billing_address: billingAddress || {},
    billing_gstin: billingGstin,
    invoice_type: invoiceType,
    payment_status: 'pending',
  });
};

export const Invoice = mongoose.model('Invoice', invoiceSchema);
