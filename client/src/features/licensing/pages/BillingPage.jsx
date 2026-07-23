import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  TrendingUp,
  Building,
  Receipt,
  Tag,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Loader2,
  Loader,
} from "lucide-react";
import useLicensing from "../hooks/useLicensing";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useUserRole } from "../../../utils/auth";
import jsPDF from "jspdf";
import Pagination from "../../../components/common/Pagination";
import * as transactionService from "../../../services/transactionService.js";
import * as billingDetailsService from "../../../services/billingDetailsService.js";
/**
 * Billing & Invoices Page - Billing summary card, payment history table with Download Invoice
 * Connected to real API endpoints
 */
export default function BillingPage() {
  const [autoRenew, setAutoRenew] = useState(true);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isRetrying, setIsRetrying] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [updateErrors, setUpdateErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { isAdmin, user } = useUserRole();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isBillingUpdating, setIsBillingUpdating] = useState(false);
  const [billingFormData, setBillingFormData] = useState({});
  const [billingDetails, setBillingDetails] = useState([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isBillingFormOpen, setIsBillingFormOpen] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState(null);
  const [deleteBillingConfirm, setDeleteBillingConfirm] = useState({
    isOpen: false,
    id: null,
  });

  // Access control: Check if user has permission to view billing
  // Allowed roles: Company Admin (org_admin), User as Admin (individual), Super Admin (super_admin)
  // Blocked: Normal User (employee), Manager (manager)
  const userRole =
    user?.activeRole ||
    (Array.isArray(user?.role) ? user?.role[0] : user?.role);
  const hasAccessToBilling =
    user &&
    (userRole === "org_admin" ||
      userRole === "individual" ||
      userRole === "super_admin");

  // Redirect if no access
  useEffect(() => {
    if (user && !hasAccessToBilling) {
      setLocation("/dashboard");
    }
  }, [user, hasAccessToBilling, setLocation]);

  // Show loading or no access message
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasAccessToBilling) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              You do not have permission to view billing information. Please
              contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch invoices from API (transactions)
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ["invoices", currentPage, itemsPerPage],
    queryFn: async () => {
      return await transactionService.getOrganizationTransactions(
        currentPage,
        itemsPerPage,
      );
    },
  });

  // Fetch subscription data from API
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/subscription", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch subscription");
      const data = await response.json();
      return data.subscription;
    },
  });

  const {
    currentPlan: currentPlanKey,
    billingCycle,
    getCurrentPlan,
    hasAccess,
  } = useLicensing();

  const currentPlan = getCurrentPlan();
  const currentPrice = currentPlan.price[billingCycle];
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(
    nextBillingDate.getMonth() + (billingCycle === "yearly" ? 12 : 1),
  );

  // Use subscription data from API if available
  const displayPlanName =
    subscriptionData?.license_details?.name || currentPlan.name;
  const displayPrice =
    subscriptionData?.license_details?.price_monthly || currentPrice;
  const displayCurrency = "₹";

  // Removed mock billing data - using real API data only

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleRetryInvoices = async () => {
    setIsRetrying(true);
    setDownloadError("");
    try {
      await refetchInvoices();
    } catch (error) {
      setDownloadError("Failed to refresh invoices");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSortInvoices = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    );
  };

  // const handleDownloadInvoice = (invoiceId) => {
  //   setDownloadError('');

  //   // Mock download with error handling
  //   const shouldFail = Math.random() < 0.2; // 20% chance of failure for demo

  //   if (shouldFail) {
  //     setDownloadError('Unable to download invoice, please try again later.');
  //     return;
  //   }

  //   console.log(`Downloading invoice ${invoiceId}`);
  //   // Simulate file download
  //   const link = document.createElement('a');
  //   link.href = `#`; // In real app: `/api/invoices/${invoiceId}/download`
  //   link.download = `invoice-${invoiceId}.pdf`;
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  const handleDownloadInvoice = async (invoiceId, invoiceData) => {
    setDownloadError("");

    try {
      // Use original transaction data if available, otherwise use transformed invoice data
      const txnData = invoiceData?._originalTransaction || invoiceData;

      // Log invoice data for debugging
      console.log("📄 Invoice Data:", {
        id: invoiceId,
        plan: invoiceData?.plan,
        seats: invoiceData?.seats,
        amount: invoiceData?.amount,
        discount: invoiceData?.discount_amount,
        paymentMethod: invoiceData?.paymentMethod,
        status: invoiceData?.status,
        // Original transaction data
        txnLicenseName: txnData?.license_name,
        txnSeats: txnData?.seats_purchased,
        txnTotalPrice: txnData?.total_price,
        txnAmountPaid: txnData?.amount_paid,
        txnPaymentMethod: txnData?.payment_method,
        txnUserRole: txnData?.user_id?.role,
        txnUserName: txnData?.user_id?.firstName
          ? `${txnData?.user_id?.firstName} ${txnData?.user_id?.lastName}`
          : txnData?.user_id?.name,
      });

      // Skip API call - generate PDF directly from transaction data
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPosition = margin;

      // Utility: Clean and parse amounts - extract core numeric value robustly
      const cleanAmount = (val) => {
        if (val === null || val === undefined || val === "") return 0;
        const num = parseFloat(String(val).trim());
        return isNaN(num) ? 0 : num;
      };

      // Set default font
      doc.setFont("helvetica");

      // ===== HEADER =====
      doc.setFontSize(24);
      doc.setTextColor(41, 128, 185);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", margin, yPosition);
      yPosition += 12;

      // Company Info
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text("TaskSetu", margin, yPosition);
      yPosition += 4;
      doc.text("Invoice Management System", margin, yPosition);
      yPosition += 8;

      // Separator
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;

      // ===== INVOICE DETAILS =====
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");

      // Left column - Invoice Info
      doc.text("INVOICE DETAILS", margin, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");
      doc.text(`Invoice ID: ${invoiceId || "N/A"}`, margin, yPosition);
      yPosition += 5;
      doc.text(
        `Date: ${invoiceData?.date ? new Date(invoiceData.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : new Date().toLocaleDateString("en-IN")}`,
        margin,
        yPosition,
      );
      yPosition += 5;
      doc.text(
        `Status: ${invoiceData?.status?.toUpperCase() || "COMPLETED"}`,
        margin,
        yPosition,
      );
      yPosition += 5;
      doc.text(
        `GSTIN: 07AQOPG0103A1ZO`,
        margin,
        yPosition,
      );
      yPosition += 8;

      // ===== BILL TO =====
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text("BILL TO", margin, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");

      // Determine billing name based on user role
      let billingName = "Organization";
      const userRole =
        txnData?.user_id?.role || invoiceData?.user_id?.role || "individual";

      if (userRole === "individual") {
        // For individual users, show user's full name
        const userData = txnData?.user_id || invoiceData?.user_id || {};
        const firstName = userData.firstName || userData.first_name || "";
        const lastName = userData.lastName || userData.last_name || "";

        if (firstName && lastName) {
          billingName = `${firstName} ${lastName}`;
        } else if (firstName) {
          billingName = firstName;
        } else if (userData.name) {
          billingName = userData.name;
        } else {
          billingName =
            userData.username || userData.email?.split("@")[0] || "User";
        }
      } else {
        // For org admin, show organization name
        billingName =
          txnData?.organization_id?.name ||
          invoiceData?.organization_id?.name ||
          "Organization";
      }

      const userEmail =
        txnData?.user_id?.email ||
        invoiceData?.user_id?.email ||
        "user@example.com";

      doc.text(billingName, margin, yPosition);
      yPosition += 5;
      doc.text(userEmail, margin, yPosition);
      yPosition += 8;

      // ===== PAYMENT DETAILS =====
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text("PAYMENT DETAILS", margin, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");
      const paymentMethod =
        invoiceData?.paymentMethod || txnData?.payment_method || "RAZORPAY";
      const paymentStatus =
        invoiceData?.status?.toUpperCase() ||
        txnData?.status?.toUpperCase() ||
        "COMPLETED";
      const currency = txnData?.currency || "INR";

      doc.text(`Payment Method: ${paymentMethod}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Payment Status: ${paymentStatus}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Currency: ${currency}`, margin, yPosition);
      yPosition += 8;

      // ===== ITEMS TABLE =====
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text("ORDER DETAILS", margin, yPosition);
      yPosition += 6;

      // Table header
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(41, 128, 185);

      const col1 = margin;
      const col2 = margin + 80;
      const col3 = margin + 120;
      const col4 = margin + 150;
      const colHeight = 6;

      doc.rect(col1 - 1, yPosition - 4, contentWidth + 2, colHeight, "F");
      doc.text("Description", col1, yPosition);
      doc.text("Qty", col2, yPosition);
      doc.text("Price/Unit", col3, yPosition);
      doc.text("Total", col4, yPosition);
      yPosition += 7;

      // Table rows
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");

      // ✅ Support multiple items in transaction
      // Check if transaction has items array (new format) or single license (legacy)
      let itemsList = [];

      if (
        txnData?.items &&
        Array.isArray(txnData.items) &&
        txnData.items.length > 0
      ) {
        // New format: multiple items
        itemsList = txnData.items;
      } else {
        // Legacy format: single license
        itemsList = [
          {
            license_name:
              invoiceData?.plan || txnData?.license_name || "License",
            seats_purchased: parseInt(
              invoiceData?.seats || txnData?.seats_purchased || 1,
            ),
            price_per_seat: null, // Will calculate below
            total_price:
              txnData?.total_price ||
              txnData?.final_amount ||
              invoiceData?.amount ||
              txnData?.amount_paid,
          },
        ];
      }

      // Format amounts for PDF - strict currency formatting
      const formatCurrency = (amount) => {
        const num = cleanAmount(amount);
        return "Rs. " + num.toFixed(2);
      };

      // ✅ Display each item as a separate row
      let itemsSubtotal = 0;
      itemsList.forEach((item, index) => {
        const itemSeats = item.seats_purchased || 1;
        const itemTotal = cleanAmount(item.total_price || 0);
        // Use stored price_per_seat if valid, else calculate from total/seats
        const itemPricePerSeat =
          item.price_per_seat && item.price_per_seat > 0
            ? cleanAmount(item.price_per_seat)
            : itemSeats > 0
              ? itemTotal / itemSeats
              : 0;

        // Accumulate subtotal (before discount/GST)
        itemsSubtotal += itemTotal;

        // Draw each item row
        doc.text(item.license_name || "License", col1, yPosition);
        doc.text(String(itemSeats), col2, yPosition);
        doc.text(formatCurrency(itemPricePerSeat), col3, yPosition);
        doc.text(formatCurrency(itemTotal), col4, yPosition);
        yPosition += 8;

        console.log(`✅ Invoice Item ${index + 1}:`, {
          name: item.license_name,
          seats: itemSeats,
          pricePerSeat: itemPricePerSeat.toFixed(2),
          total: itemTotal.toFixed(2),
        });
      });

      // ===== SUMMARY =====
      doc.setDrawColor(200, 200, 200);
      doc.line(col3 - 5, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;

      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal");

      // Use the calculated items subtotal
      const subtotal = cleanAmount(itemsSubtotal);
      const discount = cleanAmount(
        invoiceData?.discount_amount || txnData?.discount_amount,
      );

      // Calculate before-GST amount (subtotal - discount)
      const beforeGSTAmount = subtotal - discount;

      // ✅ Calculate 18% GST on the before-GST amount
      const gstRate = 0.18;
      const gstAmount = beforeGSTAmount * gstRate;

      // Final total = before-GST amount + GST
      const finalAmount = beforeGSTAmount + gstAmount;

      // Safe currency formatter for summary
      const formatSummary = (amount) => {
        const num = cleanAmount(amount);
        return "Rs. " + num.toFixed(2);
      };

      // Summary right-aligned to page edge to avoid label/value overlap
      const summaryLabelX = col3;
      const summaryValueX = pageWidth - margin;

      // Display subtotal (sum of all items)
      doc.text("Subtotal:", summaryLabelX, yPosition);
      doc.text(formatSummary(subtotal), summaryValueX, yPosition, {
        align: "right",
      });
      yPosition += 5;

      // Display discount if applicable
      if (discount > 0) {
        doc.text("Discount:", summaryLabelX, yPosition);
        doc.text("-" + formatSummary(discount), summaryValueX, yPosition, {
          align: "right",
        });
        yPosition += 5;
      }

      // ✅ Display 18% GST
      doc.text("GST (18%):", summaryLabelX, yPosition);
      doc.text("+" + formatSummary(gstAmount), summaryValueX, yPosition, {
        align: "right",
      });
      yPosition += 5;

      // ✅ Final Total with GST
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("TOTAL:", summaryLabelX, yPosition);
      doc.text(formatSummary(finalAmount), summaryValueX, yPosition, {
        align: "right",
      });
      yPosition += 10;

      // ✅ Log complete invoice calculation after all variables are defined
      console.log("💰 Complete Invoice Calculation:", {
        itemCount: itemsList.length,
        itemsSubtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        beforeGSTAmount: beforeGSTAmount.toFixed(2),
        gstRate: gstRate * 100 + "%",
        gstAmount: gstAmount.toFixed(2),
        finalTotal: finalAmount.toFixed(2),
        formatted: formatSummary(finalAmount),
        billingName: billingName,
        userRole: userRole,
      });

      // ===== ADDITIONAL INFO =====
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");

      if (invoiceData?.transactionId || txnData?.transaction_id) {
        doc.text(
          `Transaction ID: ${invoiceData?.transactionId || txnData?.transaction_id}`,
          margin,
          yPosition,
        );
        yPosition += 4;
      }

      if (txnData?.discount_code) {
        const discountPercent = txnData?.discount_percentage
          ? ` (${txnData.discount_percentage}%)`
          : "";
        doc.text(
          `Discount Code: ${txnData.discount_code}${discountPercent}`,
          margin,
          yPosition,
        );
        yPosition += 4;
      }

      doc.text(
        `Billing Cycle: ${invoiceData?.period?.toUpperCase() || txnData?.billing_cycle || "Monthly"}`,
        margin,
        yPosition,
      );
      yPosition += 4;

      if (txnData?.razorpay_payment_id) {
        doc.text(
          `Payment ID: ${txnData.razorpay_payment_id}`,
          margin,
          yPosition,
        );
        yPosition += 4;
      }

      if (txnData?.renewal_date) {
        const renewalDate = new Date(txnData.renewal_date).toLocaleDateString(
          "en-IN",
          { year: "numeric", month: "long", day: "numeric" },
        );
        doc.text(`Next Renewal Date: ${renewalDate}`, margin, yPosition);
        yPosition += 4;
      }

      // ===== FOOTER =====
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.text("Thank you for your business.", margin, pageHeight - 10);
      doc.text(
        `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
        margin,
        pageHeight - 5,
      );

      // ===== GENERATE AND DOWNLOAD =====
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("✅ Invoice PDF downloaded successfully:", invoiceId);
    } catch (err) {
      console.error("❌ PDF Generation Error:", err);
      setDownloadError("Unable to generate invoice. Please try again.");
      toast({
        title: "Error",
        description:
          "Failed to download invoice. Please check console for details.",
        variant: "destructive",
      });
    }
  };

  // Load billing details on mount
  useEffect(() => {
    loadBillingDetails();
  }, []);

  const loadBillingDetails = async () => {
    setIsLoadingBilling(true);
    try {
      const data = await billingDetailsService.getAllBillingDetails();
      setBillingDetails(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading billing details:", error);
      toast({
        title: "Error",
        description: "Failed to load billing details",
        variant: "destructive",
      });
      setBillingDetails([]);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const handleBillingFormSubmit = async () => {
    try {
      if (editingBillingId) {
        // Update existing
        await billingDetailsService.updateBillingDetails(
          editingBillingId,
          billingFormData,
        );
        toast({
          title: "Success",
          description: "Billing details updated successfully",
        });
      } else {
        // Create new
        await billingDetailsService.createBillingDetails(billingFormData);
        toast({
          title: "Success",
          description: "Billing details created successfully",
        });
      }
      setIsBillingFormOpen(false);
      setEditingBillingId(null);
      loadBillingDetails();
    } catch (error) {
      console.error("Error saving billing details:", error);
      toast({
        title: "Error",
        description: "Failed to save billing details",
        variant: "destructive",
      });
    }
  };

  const handleDeleteBilling = async (id) => {
    setDeleteBillingConfirm({ isOpen: true, id });
  };

  const handleSetDefaultBilling = async (id) => {
    try {
      await billingDetailsService.setDefaultBillingDetails(id);
      toast({
        title: "Success",
        description: "Default billing details updated",
      });
      loadBillingDetails();
    } catch (error) {
      console.error("Error setting default billing details:", error);
      toast({
        title: "Error",
        description: "Failed to set default billing details",
        variant: "destructive",
      });
    }
  };

  const validateBillingDetails = (formData) => {
    const errors = {};

    if (!formData.cardNumber || formData.cardNumber.length < 16) {
      errors.cardNumber = "Please enter a valid card number";
    }

    if (!formData.expiry || !/^\d{2}\/\d{2}$/.test(formData.expiry)) {
      errors.expiry = "Please enter a valid expiry date (MM/YY)";
    }

    if (!formData.cvv || formData.cvv.length < 3) {
      errors.cvv = "Please enter a valid CVV";
    }

    if (!formData.gstNumber && formData.gstNumber !== "") {
      errors.gstNumber = "GST/VAT number format is invalid";
    }

    return errors;
  };

  const handleUpdateBilling = async (formData) => {
    const errors = validateBillingDetails(formData);
    setUpdateErrors(errors);

    if (Object.keys(errors).length === 0) {
      setIsBillingUpdating(true);
      try {
        const response = await fetch("/api/billing/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            payment_method: {
              card_number: formData.cardNumber?.replace(/\s/g, ""),
              expiry: formData.expiry,
              cvv: formData.cvv,
              cardholder_name: formData.cardholderName,
            },
            billing_contact: {
              company_name: formData.companyName,
              contact_name: formData.contactName,
              contact_email: formData.contactEmail,
            },
            tax_info: {
              gst_number: formData.gstNumber,
              billing_address: formData.billingAddress,
              country: formData.country,
            },
          }),
        });

        if (response.ok) {
          toast({
            title: "Billing Updated",
            description: "Your billing details have been updated successfully.",
          });
          setShowBillingModal(false);
          setUpdateErrors({});
          queryClient.invalidateQueries({ queryKey: ["subscription"] });
        } else {
          const errorData = await response.json();
          toast({
            title: "Update Failed",
            description:
              errorData.message || "Failed to update billing details.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Billing update error:", error);
        toast({
          title: "Error",
          description: "An error occurred while updating billing details.",
          variant: "destructive",
        });
      } finally {
        setIsBillingUpdating(false);
      }
    }
  };

  // Country list for dropdown
  const countries = [
    { code: "AF", name: "Afghanistan" },
    { code: "AL", name: "Albania" },
    { code: "DZ", name: "Algeria" },
    { code: "AD", name: "Andorra" },
    { code: "AO", name: "Angola" },
    { code: "AG", name: "Antigua and Barbuda" },
    { code: "AR", name: "Argentina" },
    { code: "AM", name: "Armenia" },
    { code: "AU", name: "Australia" },
    { code: "AT", name: "Austria" },
    { code: "AZ", name: "Azerbaijan" },
    { code: "BS", name: "Bahamas" },
    { code: "BH", name: "Bahrain" },
    { code: "BD", name: "Bangladesh" },
    { code: "BB", name: "Barbados" },
    { code: "BY", name: "Belarus" },
    { code: "BE", name: "Belgium" },
    { code: "BZ", name: "Belize" },
    { code: "BJ", name: "Benin" },
    { code: "BT", name: "Bhutan" },
    { code: "BO", name: "Bolivia" },
    { code: "BA", name: "Bosnia and Herzegovina" },
    { code: "BW", name: "Botswana" },
    { code: "BR", name: "Brazil" },
    { code: "BN", name: "Brunei" },
    { code: "BG", name: "Bulgaria" },
    { code: "BF", name: "Burkina Faso" },
    { code: "BI", name: "Burundi" },
    { code: "KH", name: "Cambodia" },
    { code: "CM", name: "Cameroon" },
    { code: "CA", name: "Canada" },
    { code: "CV", name: "Cape Verde" },
    { code: "CF", name: "Central African Republic" },
    { code: "TD", name: "Chad" },
    { code: "CL", name: "Chile" },
    { code: "CN", name: "China" },
    { code: "CO", name: "Colombia" },
    { code: "KM", name: "Comoros" },
    { code: "CG", name: "Congo" },
    { code: "CR", name: "Costa Rica" },
    { code: "HR", name: "Croatia" },
    { code: "CU", name: "Cuba" },
    { code: "CY", name: "Cyprus" },
    { code: "CZ", name: "Czech Republic" },
    { code: "DK", name: "Denmark" },
    { code: "DJ", name: "Djibouti" },
    { code: "DM", name: "Dominica" },
    { code: "DO", name: "Dominican Republic" },
    { code: "EC", name: "Ecuador" },
    { code: "EG", name: "Egypt" },
    { code: "SV", name: "El Salvador" },
    { code: "GQ", name: "Equatorial Guinea" },
    { code: "ER", name: "Eritrea" },
    { code: "EE", name: "Estonia" },
    { code: "ET", name: "Ethiopia" },
    { code: "FJ", name: "Fiji" },
    { code: "FI", name: "Finland" },
    { code: "FR", name: "France" },
    { code: "GA", name: "Gabon" },
    { code: "GM", name: "Gambia" },
    { code: "GE", name: "Georgia" },
    { code: "DE", name: "Germany" },
    { code: "GH", name: "Ghana" },
    { code: "GR", name: "Greece" },
    { code: "GD", name: "Grenada" },
    { code: "GT", name: "Guatemala" },
    { code: "GN", name: "Guinea" },
    { code: "GW", name: "Guinea-Bissau" },
    { code: "GY", name: "Guyana" },
    { code: "HT", name: "Haiti" },
    { code: "HN", name: "Honduras" },
    { code: "HU", name: "Hungary" },
    { code: "IS", name: "Iceland" },
    { code: "IN", name: "India" },
    { code: "ID", name: "Indonesia" },
    { code: "IR", name: "Iran" },
    { code: "IQ", name: "Iraq" },
    { code: "IE", name: "Ireland" },
    { code: "IL", name: "Israel" },
    { code: "IT", name: "Italy" },
    { code: "JM", name: "Jamaica" },
    { code: "JP", name: "Japan" },
    { code: "JO", name: "Jordan" },
    { code: "KZ", name: "Kazakhstan" },
    { code: "KE", name: "Kenya" },
    { code: "KI", name: "Kiribati" },
    { code: "KP", name: "North Korea" },
    { code: "KR", name: "South Korea" },
    { code: "KW", name: "Kuwait" },
    { code: "KG", name: "Kyrgyzstan" },
    { code: "LA", name: "Laos" },
    { code: "LV", name: "Latvia" },
    { code: "LB", name: "Lebanon" },
    { code: "LS", name: "Lesotho" },
    { code: "LR", name: "Liberia" },
    { code: "LY", name: "Libya" },
    { code: "LI", name: "Liechtenstein" },
    { code: "LT", name: "Lithuania" },
    { code: "LU", name: "Luxembourg" },
    { code: "MK", name: "North Macedonia" },
    { code: "MG", name: "Madagascar" },
    { code: "MW", name: "Malawi" },
    { code: "MY", name: "Malaysia" },
    { code: "MV", name: "Maldives" },
    { code: "ML", name: "Mali" },
    { code: "MT", name: "Malta" },
    { code: "MH", name: "Marshall Islands" },
    { code: "MR", name: "Mauritania" },
    { code: "MU", name: "Mauritius" },
    { code: "MX", name: "Mexico" },
    { code: "FM", name: "Micronesia" },
    { code: "MD", name: "Moldova" },
    { code: "MC", name: "Monaco" },
    { code: "MN", name: "Mongolia" },
    { code: "ME", name: "Montenegro" },
    { code: "MA", name: "Morocco" },
    { code: "MZ", name: "Mozambique" },
    { code: "MM", name: "Myanmar" },
    { code: "NA", name: "Namibia" },
    { code: "NR", name: "Nauru" },
    { code: "NP", name: "Nepal" },
    { code: "NL", name: "Netherlands" },
    { code: "NZ", name: "New Zealand" },
    { code: "NI", name: "Nicaragua" },
    { code: "NE", name: "Niger" },
    { code: "NG", name: "Nigeria" },
    { code: "NO", name: "Norway" },
    { code: "OM", name: "Oman" },
    { code: "PK", name: "Pakistan" },
    { code: "PW", name: "Palau" },
    { code: "PA", name: "Panama" },
    { code: "PG", name: "Papua New Guinea" },
    { code: "PY", name: "Paraguay" },
    { code: "PE", name: "Peru" },
    { code: "PH", name: "Philippines" },
    { code: "PL", name: "Poland" },
    { code: "PT", name: "Portugal" },
    { code: "QA", name: "Qatar" },
    { code: "RO", name: "Romania" },
    { code: "RU", name: "Russia" },
    { code: "RW", name: "Rwanda" },
    { code: "KN", name: "Saint Kitts and Nevis" },
    { code: "LC", name: "Saint Lucia" },
    { code: "VC", name: "Saint Vincent and the Grenadines" },
    { code: "WS", name: "Samoa" },
    { code: "SM", name: "San Marino" },
    { code: "ST", name: "Sao Tome and Principe" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "SN", name: "Senegal" },
    { code: "RS", name: "Serbia" },
    { code: "SC", name: "Seychelles" },
    { code: "SL", name: "Sierra Leone" },
    { code: "SG", name: "Singapore" },
    { code: "SK", name: "Slovakia" },
    { code: "SI", name: "Slovenia" },
    { code: "SB", name: "Solomon Islands" },
    { code: "SO", name: "Somalia" },
    { code: "ZA", name: "South Africa" },
    { code: "SS", name: "South Sudan" },
    { code: "ES", name: "Spain" },
    { code: "LK", name: "Sri Lanka" },
    { code: "SD", name: "Sudan" },
    { code: "SR", name: "Suriname" },
    { code: "SZ", name: "Eswatini" },
    { code: "SE", name: "Sweden" },
    { code: "CH", name: "Switzerland" },
    { code: "SY", name: "Syria" },
    { code: "TW", name: "Taiwan" },
    { code: "TJ", name: "Tajikistan" },
    { code: "TZ", name: "Tanzania" },
    { code: "TH", name: "Thailand" },
    { code: "TL", name: "Timor-Leste" },
    { code: "TG", name: "Togo" },
    { code: "TO", name: "Tonga" },
    { code: "TT", name: "Trinidad and Tobago" },
    { code: "TN", name: "Tunisia" },
    { code: "TR", name: "Turkey" },
    { code: "TM", name: "Turkmenistan" },
    { code: "TV", name: "Tuvalu" },
    { code: "UG", name: "Uganda" },
    { code: "UA", name: "Ukraine" },
    { code: "AE", name: "United Arab Emirates" },
    { code: "GB", name: "United Kingdom" },
    { code: "US", name: "United States" },
    { code: "UY", name: "Uruguay" },
    { code: "UZ", name: "Uzbekistan" },
    { code: "VU", name: "Vanuatu" },
    { code: "VA", name: "Vatican City" },
    { code: "VE", name: "Venezuela" },
    { code: "VN", name: "Vietnam" },
    { code: "YE", name: "Yemen" },
    { code: "ZM", name: "Zambia" },
    { code: "ZW", name: "Zimbabwe" },
  ];

  // Use API data - transaction history instead of invoices
  const apiInvoices = invoicesData?.data || [];
  const hasNoInvoices = apiInvoices.length === 0;

  const displayInvoices = apiInvoices.map((transaction) => {
    const subtotal = transaction.total_price || 0;
    const amountPaid =
      transaction.amount_paid ||
      transaction.final_amount ||
      transaction.amount ||
      0;
    let discountAmount = transaction.discount_amount || 0;

    // Resilient fallback: If discount is 0 but amountPaid is less than (subtotal * 1.18)
    if (
      discountAmount === 0 &&
      amountPaid > 0 &&
      subtotal > 0 &&
      amountPaid < subtotal * 1.18 - 1
    ) {
      const impliedBeforeGST = amountPaid / 1.18;
      discountAmount = Math.max(0, subtotal - impliedBeforeGST);
    }

    return {
      id: transaction.transaction_id || transaction._id,
      date: transaction.created_at || transaction.transaction_date,
      plan: transaction.license_name || "N/A",
      period: (transaction.items?.[0]?.billing_cycle || transaction.billing_cycle || "monthly").toLowerCase(),
      amount: amountPaid,
      transactionId:
        transaction.razorpay_payment_id || transaction.transaction_id || "N/A",
      status: transaction.status?.toLowerCase() || "pending",
      paymentMethod: transaction.payment_method || "RAZORPAY",
      _id: transaction._id,
      seats: transaction.seats_purchased || 0,
      discount_amount: discountAmount,
      discount_code: transaction.discount_code || null,
      // Store original transaction data for PDF generation
      _originalTransaction: {
        ...transaction,
        discount_amount: discountAmount,
      },
    };
  });

  // Sort full list, then paginate
  const totalPages =
    invoicesData?.pagination?.totalPages ||
    Math.max(1, Math.ceil(displayInvoices.length / itemsPerPage));

  // Sort invoices
  const sortedAllInvoices = [...displayInvoices].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "date") {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else if (sortField === "amount") {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const currentPageInvoices = sortedAllInvoices;
  useEffect(() => {
    if (!isAdmin) {
      // Redirect non-admin users away from this page
      setLocation("/dashboard");
    }
  }, [isAdmin]);

  // Loading state
  if (invoicesLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 [&_*]:!rounded-none">
      <div
        className="max-w-7xl mx-auto px-6 py-3 pb-6 space-y-3"
        data-testid="billing-page"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h1
                className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}
              >
                Billing & Invoices
              </h1>
              <p className="mt-0 text-sm text-blue-600">
                Manage your subscription and download invoices
              </p>
            </div>
          </div>
        </div>

        {/* Billing Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Main Content - Left 8 columns */}
          <div className="lg:col-span-12 space-y-3">
            {/* Billing Summary Card */}
            <Card data-testid="billing-summary-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-1">
                  <CreditCard className="h-5 w-5" />
                  <span className="text-base">Billing Summary</span>
                </CardTitle>
                <CardDescription>
                  Your active plan and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Plan Info */}
                <div className="flex items-center justify-between p-2 px-4 bg-blue-50 rounded-sm border border-blue-200">
                  <div>
                    <div
                      className="font-semibold text-lg text-blue-900"
                      data-testid="current-plan-name"
                    >
                      {displayPlanName}
                    </div>
                    <div
                      className="text-sm text-blue-700"
                      data-testid="billing-cycle"
                    >
                      Billed{" "}
                      {billingCycle === "yearly" ? "annually" : "monthly"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-2xl font-bold text-blue-900"
                      data-testid="current-price"
                    >
                      {displayCurrency}
                      {displayPrice}
                    </div>
                    <div className="text-sm text-blue-700">
                      per {billingCycle === "yearly" ? "year" : "month"}
                    </div>
                  </div>
                </div>

                {/* Billing Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700">
                      Next Billing Date
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm" data-testid="next-billing-date">
                        {format(nextBillingDate, 'MMMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700">
                      Expiry Date
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm" data-testid="expiry-date">
                        {subscriptionData?.expiry_date
                          ? format(new Date(subscriptionData.expiry_date), 'MMMM d, yyyy')
                          : format(nextBillingDate, 'MMMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700">
                      Payment Status
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600" data-testid="payment-status">
                        {subscriptionData?.payment_status === 'paid' ? 'Current' : 'Active'}
                      </span>
                    </div>
                  </div> */}

                  {/* Auto-Renewal Toggle - Phase II */}
                  {/* <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      Auto-Renewal
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={autoRenew}
                        onCheckedChange={setAutoRenew}
                        data-testid="auto-renew-toggle"
                      />
                      <span className="text-sm" data-testid="auto-renew-status">
                        {autoRenew ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    {autoRenew && (
                      <div className="text-xs text-gray-500 mt-1">
                        Next billing on {format(nextBillingDate, 'MMM d, yyyy')}
                      </div>
                    )}
                    {!autoRenew && (
                      <div className="text-xs text-orange-600 mt-1">
                        Renew before expiry
                      </div>
                    )}
                  </div> */}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Billing History */}
        <Card data-testid="billing-history-card">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span className="text-base">Payment History</span>
                </CardTitle>
                <CardDescription>
                  View and download your past invoices
                </CardDescription>
              </div>

              <div className="flex items-center space-x-2">
                {/* Search Input with Magnify Icon */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search invoices..."
                    className="h-8 min-h-8 max-h-8 box-border pl-8 pr-3 py-0 border border-gray-300 rounded-md text-sm leading-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Refresh Button */}
                {displayInvoices.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryInvoices}
                    disabled={isRetrying}
                    data-testid="retry-invoices-button"
                  >
                    {isRetrying ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Download Error Alert */}
            {downloadError && (
              <Alert className="mb-3 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  {downloadError}
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-2 text-red-600"
                    onClick={() => setDownloadError("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {displayInvoices.length === 0 ? (
              /* Empty State */
              <div
                className="text-center py-12"
                data-testid="empty-billing-history"
              >
                <div className="p-3 bg-blue-100 rounded-xl w-fit mx-auto mb-3">
                  <FileText className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No billing history yet
                </h3>
                <p className="text-gray-500 text-sm mb-3">
                  {currentPlanKey === "explore"
                    ? "Upgrade to a paid plan to see invoices here."
                    : "Your invoices will appear here after your first billing cycle."}
                </p>
                {currentPlanKey === "explore" && (
                  <Button
                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() =>
                      setLocation("/admin/subscription?openPurchaseModal=true")
                    }
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade Now
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => handleSortInvoices("id")}
                        >
                          <div className="flex items-center">
                            Invoice ID
                            {getSortIcon("id")}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => handleSortInvoices("date")}
                        >
                          <div className="flex items-center">
                            Date
                            {getSortIcon("date")}
                          </div>
                        </TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Seats</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-50 select-none"
                          onClick={() => handleSortInvoices("amount")}
                        >
                          <div className="flex items-center">
                            Amount
                            {getSortIcon("amount")}
                          </div>
                        </TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hasNoInvoices ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="flex flex-col items-center text-gray-500">
                              <FileText className="h-12 w-12 mb-3 text-gray-300" />
                              <p className="text-lg font-medium">
                                No Invoices Yet
                              </p>
                              <p className="text-sm">
                                Your invoices will appear here once you make a
                                payment.
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentPageInvoices.map((invoice, index) => (
                          <TableRow
                            key={invoice.id}
                            className={
                              index % 2 === 0 ? "bg-gray-50" : "bg-white"
                            }
                            data-testid={`invoice-row-${invoice.id}`}
                          >
                            <TableCell
                              className="font-medium"
                              data-testid={`invoice-id-${invoice.id}`}
                            >
                              #{invoice.id}
                            </TableCell>
                            <TableCell
                              data-testid={`invoice-date-${invoice.id}`}
                            >
                              {format(new Date(invoice.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell
                              data-testid={`invoice-plan-${invoice.id}`}
                            >
                              {invoice.plan}
                            </TableCell>
                            <TableCell
                              data-testid={`invoice-seats-${invoice.id}`}
                            >
                              {invoice.seats}{" "}
                              {invoice.seats === 1 ? "seat" : "seats"}
                            </TableCell>
                            <TableCell
                              data-testid={`invoice-cycle-${invoice.id}`}
                            >
                              <span className="uppercase text-sm">
                                {invoice.period}
                              </span>
                            </TableCell>
                            <TableCell
                              className="font-medium"
                              data-testid={`invoice-amount-${invoice.id}`}
                            >
                              <div className="flex flex-col">
                                <span>
                                  ₹
                                  {Math.round(invoice.amount).toLocaleString(
                                    "en-IN",
                                  )}
                                </span>
                                {invoice.discount_amount > 0 && (
                                  <span className="text-[10px] text-green-600 font-normal flex items-center gap-1">
                                    <Tag className="h-2 w-2" />
                                    Saved ₹{Math.round(invoice.discount_amount)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-sm text-gray-600"
                              data-testid={`payment-method-${invoice.id}`}
                            >
                              {invoice.paymentMethod}
                            </TableCell>
                            <TableCell
                              className="text-sm text-gray-600"
                              data-testid={`transaction-id-${invoice.id}`}
                            >
                              {invoice.transactionId}
                            </TableCell>
                            <TableCell
                              data-testid={`invoice-status-${invoice.id}`}
                            >
                              <Badge
                                className={cn(
                                  "text-xs",
                                  getStatusColor(invoice.status),
                                )}
                              >
                                <div className="flex items-center space-x-1">
                                  {getStatusIcon(invoice.status)}
                                  <span className="capitalize">
                                    {invoice.status}
                                  </span>
                                </div>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDownloadInvoice(invoice.id, invoice)
                                }
                                className="text-blue-600 hover:text-blue-700"
                                data-testid={`download-invoice-${invoice.id}`}
                                aria-label={`Download invoice for ${format(new Date(invoice.date), "MMMM d, yyyy")}`}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={
                    invoicesData?.pagination?.totalCount ||
                    displayInvoices.length
                  }
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Billing Confirmation */}
      <ConfirmDialog
        isOpen={deleteBillingConfirm.isOpen}
        title="Delete Billing Detail?"
        description="Are you sure you want to delete this billing detail?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setDeleteBillingConfirm({ isOpen: false, id: null })}
        onConfirm={async () => {
          const id = deleteBillingConfirm.id;
          setDeleteBillingConfirm({ isOpen: false, id: null });
          try {
            await billingDetailsService.deleteBillingDetails(id);
            toast({
              title: "Deleted",
              description: "Billing details deleted successfully",
            });
            loadBillingDetails();
          } catch (error) {
            console.error("Error deleting billing details:", error);
            toast({
              title: "Error",
              description: "Failed to delete billing details",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}
