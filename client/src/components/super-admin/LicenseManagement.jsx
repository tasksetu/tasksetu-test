import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Package,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Receipt,
  FileText,
  Eye,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

/**
 * License Management Component - Super Admin
 * Displays organization licenses, user license assignments, payment history, and CSV export
 */
const LicenseManagement = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState(new Set());
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedIdForPayment, setSelectedIdForPayment] = useState(null);
  const [selectedPaymentEntityName, setSelectedPaymentEntityName] =
    useState("");

  // Fetch all license data
  const {
    data: licenseData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/super-admin/licenses"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/licenses", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch license data");
      return await res.json();
    },
  });

  // Fetch payment history
  const { data: paymentHistory } = useQuery({
    queryKey: ["/api/super-admin/payment-history", selectedIdForPayment],
    queryFn: async () => {
      if (!selectedIdForPayment) return null;
      const res = await fetch(
        `/api/super-admin/payment-history/${selectedIdForPayment}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch payment history");
      return await res.json();
    },
    enabled: !!selectedIdForPayment,
  });

  const toggleOrgExpansion = (orgId) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const handleDownloadInvoice = (payment) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // ── Helpers ──────────────────────────────────────────────
      const cleanAmt = (v) => {
        const n = parseFloat(String(v ?? 0));
        return isNaN(n) ? 0 : n;
      };
      const fmtCurrency = (n) => "Rs. " + cleanAmt(n).toFixed(2);
      const fmtDate = (d) =>
        d
          ? new Date(d).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A";

      const invoiceNumber =
        payment.invoiceId || `INV-${Math.floor(Math.random() * 9000) + 1000}`;

      // ── HEADER BLUE BAR ───────────────────────────────────────
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, pageWidth, 18, "F");

      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", margin, 12);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("TaskSetu · Invoice Management System", pageWidth - margin, 12, {
        align: "right",
      });

      y = 26;

      // ── INVOICE DETAILS and BILL TO (two columns) ─────────────
      // Left: Bill To
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("BILL TO", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      doc.text(selectedPaymentEntityName || "Organization / User", margin, y);
      y += 4;
      doc.setTextColor(120, 120, 120);
      doc.text("TaskSetu Customer", margin, y);

      // Right: Invoice meta
      const rightX = pageWidth / 2 + 10;
      let ry = 26;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("INVOICE DETAILS", rightX, ry);
      ry += 5;

      const meta = [
        ["Invoice #:", invoiceNumber],
        ["Date:", fmtDate(payment.date)],
        ["Status:", (payment.status || "PAID").toUpperCase()],
        ["Payment Method:", payment.paymentMethod || "RAZORPAY"],
        ["Transaction ID:", payment.transactionId || "N/A"],
        ["Currency:", payment.currency || "INR"],
        ["GSTIN:", "07AQOPG0103A1ZO"],
      ];

      meta.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(80, 80, 80);
        doc.text(label, rightX, ry);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.text(String(value), rightX + 38, ry);
        ry += 5;
      });

      y = Math.max(y, ry) + 8;

      // ── SEPARATOR ─────────────────────────────────────────────
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;

      // ── PAYMENT DETAILS heading ───────────────────────────────
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("PAYMENT DETAILS", margin, y);
      y += 5;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Payment Method: ${payment.paymentMethod || "RAZORPAY"}`,
        margin,
        y,
      );
      y += 4;
      doc.text(
        `Payment Status: ${(payment.status || "PAID").toUpperCase()}`,
        margin,
        y,
      );
      y += 4;
      doc.text(`Currency: ${payment.currency || "INR"}`, margin, y);
      y += 9;

      // ── ORDER DETAILS TABLE ───────────────────────────────────
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text("ORDER DETAILS", margin, y);
      y += 5;

      // Back-calculate amounts (amount = final with 18% GST)
      const finalAmount = cleanAmt(payment.amount);
      const beforeGSTAmount = Math.round((finalAmount / 1.18) * 100) / 100;
      const gstAmount = Math.round((finalAmount - beforeGSTAmount) * 100) / 100;

      // Build table rows — use items[] for multi-license breakdown, fallback to single row
      let tableBody;
      if (payment.items && payment.items.length > 0) {
        tableBody = payment.items.map((item) => [
          `${item.license_name || item.license_code || "License"} Subscription`,
          String(item.seats_purchased || 1),
          (item.billing_cycle || payment.cycle || "monthly")
            .charAt(0)
            .toUpperCase() +
            (item.billing_cycle || payment.cycle || "monthly")
              .slice(1)
              .toLowerCase(),
          fmtCurrency(item.price_per_seat || 0),
          fmtCurrency(item.total_price || 0),
        ]);
      } else {
        // Fallback: single row, reverse-calculate price/seat
        const seats = parseInt(payment.seats) || 1;
        const pricePerSeat =
          seats > 0
            ? Math.round((beforeGSTAmount / seats) * 100) / 100
            : beforeGSTAmount;
        tableBody = [
          [
            `${payment.plan || "License Plan"} Subscription`,
            String(seats),
            (payment.cycle || "monthly").charAt(0).toUpperCase() +
              (payment.cycle || "monthly").slice(1),
            fmtCurrency(pricePerSeat),
            fmtCurrency(beforeGSTAmount),
          ],
        ];
      }

      // Table using autoTable
      autoTable(doc, {
        startY: y,
        head: [
          [
            "Description",
            "Qty / Seats",
            "Billing Cycle",
            "Price/Unit",
            "Total",
          ],
        ],
        body: tableBody,
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        bodyStyles: { fontSize: 8.5, textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [245, 250, 255] },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 25, halign: "center" },
          2: { cellWidth: 30, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" },
        },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
      });

      y = doc.lastAutoTable.finalY + 6;

      // ── SUMMARY BOX ───────────────────────────────────────────
      doc.setDrawColor(200, 200, 200);
      doc.line(pageWidth / 2, y, pageWidth - margin, y);
      y += 6;

      const summaryLabelX = pageWidth / 2 + 2;
      const summaryValueX = pageWidth - margin;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);

      doc.text("Subtotal:", summaryLabelX, y);
      doc.text(fmtCurrency(beforeGSTAmount), summaryValueX, y, {
        align: "right",
      });
      y += 5;

      doc.text("GST (18%):", summaryLabelX, y);
      doc.text("+" + fmtCurrency(gstAmount), summaryValueX, y, {
        align: "right",
      });
      y += 5;

      // Total line
      doc.setDrawColor(41, 128, 185);
      doc.line(summaryLabelX, y - 1, summaryValueX, y - 1);
      y += 3;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(41, 128, 185);
      doc.text("TOTAL:", summaryLabelX, y);
      doc.text(fmtCurrency(finalAmount), summaryValueX, y, { align: "right" });
      y += 12;

      // ── ADDITIONAL INFO ───────────────────────────────────────
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);

      if (payment.transactionId) {
        doc.text(`Transaction ID: ${payment.transactionId}`, margin, y);
        y += 4;
      }
      doc.text(
        `Billing Cycle: ${(payment.cycle || "Monthly").toUpperCase()}`,
        margin,
        y,
      );
      y += 4;
      if (payment.date) {
        doc.text(`Payment Date: ${fmtDate(payment.date)}`, margin, y);
        y += 4;
      }

      // ── FOOTER ────────────────────────────────────────────────
      doc.setFillColor(41, 128, 185);
      doc.rect(0, pageHeight - 14, pageWidth, 14, "F");

      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Thank you for your business. This is a computer-generated invoice.",
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" },
      );
      doc.text(
        `Generated on: ${new Date().toLocaleDateString("en-IN")}`,
        pageWidth / 2,
        pageHeight - 4,
        { align: "center" },
      );

      doc.save(`Invoice_${invoiceNumber}.pdf`);

      toast({
        title: "Download Started",
        description: `Invoice ${invoiceNumber} downloaded successfully`,
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Download Failed",
        description: "Could not generate invoice PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      toast({
        title: "Exporting...",
        description: "Preparing license data CSV",
      });

      const res = await fetch("/api/super-admin/licenses/export-csv", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `license-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "License data exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export license data",
        variant: "destructive",
      });
    }
  };

  const getLicenseStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "assigned":
        return "text-green-600 bg-green-50 border-green-200";
      case "expired":
        return "text-red-600 bg-red-50 border-red-200";
      case "trial":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "suspended":
      case "cancelled":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "paid":
      case "success":
      case "complete":
      case "completed":
        return "text-green-600 bg-green-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "failed":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const filteredOrganizations =
    licenseData?.organizations?.filter((org) => {
      const matchesSearch =
        org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.license?.planName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterStatus === "all" ||
        org.license?.status?.toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesFilter;
    }) || [];

  const filteredIndividuals =
    licenseData?.individuals?.filter((user) => {
      const matchesSearch =
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.license?.planName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterStatus === "all" ||
        user.license?.status?.toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesFilter;
    }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading license data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-7 w-7 text-blue-600" />
            License Management
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor organization licenses, user assignments, and payment history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-9 flex items-center gap-2"
            onClick={() => refetch()}
          >
            <RefreshCw size={18} />
            Refresh
          </Button>
          <Button
            variant="default"
            className="h-9 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleExportCSV}
          >
            <Download size={18} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Organizations</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenseData?.summary?.totalOrganizations || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-sm">
              <Building2 className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Licenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenseData?.summary?.activeLicenses || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-sm">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenseData?.summary?.totalUsers || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-sm">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{licenseData?.summary?.monthlyRevenue || 0}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-sm">
              <DollarSign className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-sm shadow-sm border mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search organizations, users or license plans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-10 pr-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Organizations License List */}
      <div className="bg-white rounded-sm shadow-sm border mb-3">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Organizations & Licenses ({filteredOrganizations.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredOrganizations.map((org) => {
            const isExpanded = expandedOrgs.has(org._id || org.id);
            return (
              <div
                key={org._id || org.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Organization Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleOrgExpansion(org._id || org.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <button className="text-gray-600 hover:text-gray-900">
                      {isExpanded ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                    <Building2 className="text-blue-600" size={20} />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {org.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {org.users?.length || 0} users
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {org.license?.planName || "No License"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {org.license?.seats || 0} seats / ₹
                        {org.license?.price || 0}/mo
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getLicenseStatusColor(org.license?.status)}`}
                    >
                      {org.license?.status || "Inactive"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIdForPayment(org._id || org.id);
                        setSelectedPaymentEntityName(org.name);
                        setShowPaymentHistory(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Receipt size={16} />
                      Payment History
                    </Button>
                  </div>
                </div>

                {/* Expanded Section - License Details & User Assignments */}
                {isExpanded && (
                  <div className="mt-4 ml-12 space-y-3">
                    {/* License Details */}
                    {/* <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Package size={16} className="text-blue-600" />
                        License Details
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-gray-600">Plan Type</p>
                          <p className="text-sm font-medium text-gray-900">{org.license?.planType || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Start Date</p>
                          <p className="text-sm font-medium text-gray-900">
                            {org.license?.startDate ? new Date(org.license.startDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">End Date</p>
                          <p className="text-sm font-medium text-gray-900">
                            {org.license?.endDate ? new Date(org.license.endDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Billing Cycle</p>
                          <p className="text-sm font-medium text-gray-900">{org.license?.billingCycle || 'Monthly'}</p>
                        </div>
                      </div>
                    </div> */}

                    {/* User License Assignments */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Users size={16} className="text-purple-600" />
                        User License Assignments ({org.users?.length || 0})
                      </h4>
                      {org.users && org.users.length > 0 ? (
                        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  User
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  License Type
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Role
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Assigned Date
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {org.users.map((user, idx) => (
                                <tr
                                  key={user._id || idx}
                                  className="hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {user.name}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {user.email}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                      {user.licenseType || "Standard"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {user.role || "User"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-medium ${user.isActive ? "text-green-600 bg-green-50" : "text-gray-600 bg-gray-50"}`}
                                    >
                                      {user.isActive ? "Active" : "Inactive"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {user.licenseAssignedDate
                                      ? new Date(
                                          user.licenseAssignedDate,
                                        ).toLocaleDateString()
                                      : "N/A"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-sm border border-gray-200 text-center">
                          <Users
                            className="mx-auto text-gray-400 mb-2"
                            size={32}
                          />
                          <p className="text-gray-600 text-sm">
                            No users assigned to this organization
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredOrganizations.length === 0 && (
            <div className="p-12 text-center">
              <Building2 className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600">No organizations found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Individual User License List */}
      <div className="mt-8 bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden mb-3">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-purple-600" size={20} />
            Individual User Licenses
            {filteredIndividuals.length > 0 && (
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full ml-1">
                {filteredIndividuals.length}
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            Users with direct/personal licenses
          </p>
        </div>

        <div className="overflow-x-auto">
          {filteredIndividuals.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Billing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIndividuals.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {user.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {user.license?.planName || "Free"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getLicenseStatusColor(user.license?.status || "inactive")}`}
                      >
                        {user.license?.status?.toUpperCase() || "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {user.license?.billingCycle || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.license?.endDate
                        ? new Date(user.license?.endDate).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedIdForPayment(user._id);
                          setSelectedPaymentEntityName(user.name);
                          setShowPaymentHistory(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center justify-center gap-1 mx-auto"
                      >
                        <Receipt size={14} />
                        Payments
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-7 text-center bg-white">
              <Users className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-600">
                No individual users found matching your criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment History Modal */}
      {showPaymentHistory && selectedIdForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl max-w-7xl w-full max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard className="text-blue-600" size={24} />
                  Payment History
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPaymentEntityName || "Entity"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentHistory(false);
                  setSelectedIdForPayment(null);
                  setSelectedPaymentEntityName("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {paymentHistory?.payments &&
              paymentHistory.payments.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seats
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cycle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment Method
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paymentHistory.payments.map((payment, idx) => (
                        <tr
                          key={payment._id || idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            #
                            {payment.invoiceId ||
                              `INV-${String(idx + 1).padStart(4, "0")}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.date
                              ? new Date(payment.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {payment.plan || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.seats || 0}{" "}
                            {payment.seats === 1 ? "seat" : "seats"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <span className="capitalize">
                              {payment.cycle || "Monthly"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            ₹{payment.amount || 0}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.paymentMethod || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.transactionId || "N/A"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                                [
                                  "paid",
                                  "success",
                                  "complete",
                                  "completed",
                                ].includes(payment.status?.toLowerCase())
                                  ? "bg-green-100 text-green-800"
                                  : payment.status?.toLowerCase() === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {[
                                "paid",
                                "success",
                                "complete",
                                "completed",
                              ].includes(payment.status?.toLowerCase()) ? (
                                <CheckCircle size={12} />
                              ) : payment.status?.toLowerCase() ===
                                "pending" ? (
                                <Clock size={12} />
                              ) : (
                                <AlertCircle size={12} />
                              )}
                              <span className="capitalize">
                                {payment.status || "Unknown"}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                              onClick={() => handleDownloadInvoice(payment)}
                            >
                              <Download size={14} />
                              Download
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Receipt className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-600">No payment history available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicenseManagement;
