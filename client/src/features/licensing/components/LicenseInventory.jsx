import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Users,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  AlertCircle,
  RefreshCcw,
  TrendingUp,
  Clock,
} from "lucide-react";

/**
 * 🆕 LICENSE INVENTORY COMPONENT
 * Shows company's license pool with inventory management
 */
export function LicenseInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseQuantities, setPurchaseQuantities] = useState({
    EXPLORE: 0,
    PLAN: 0,
    EXECUTE: 0,
    OPTIMIZE: 0,
  });

  // Fetch license inventory
  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["license-inventory"],
    queryFn: async () => {
      const response = await fetch("/api/licenses/inventory", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch inventory");
      const data = await response.json();
      return data.inventory;
    },
  });

  // Purchase licenses mutation
  const purchaseMutation = useMutation({
    mutationFn: async (licenses) => {
      const response = await fetch("/api/licenses/purchase-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ licenses }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to purchase licenses");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Licenses Purchased",
        description: `Successfully purchased ${data.data.licenses_created} licenses`,
      });
      queryClient.invalidateQueries(["license-inventory"]);
      setShowPurchaseModal(false);
      setPurchaseQuantities({ EXPLORE: 0, PLAN: 0, EXECUTE: 0, OPTIMIZE: 0 });
    },
    onError: (error) => {
      toast({
        title: "❌ Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePurchase = () => {
    const licenses = {};
    Object.entries(purchaseQuantities).forEach(([type, qty]) => {
      if (qty > 0) {
        licenses[type] = qty;
      }
    });

    if (Object.keys(licenses).length === 0) {
      toast({
        title: "No licenses selected",
        description: "Please select at least one license to purchase",
        variant: "destructive",
      });
      return;
    }

    purchaseMutation.mutate(licenses);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Inventory...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-7">
            <RefreshCcw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const licenseTypes = [
    { key: "EXPLORE", name: "Explore", color: "bg-gray-500", icon: "🔍" },
    { key: "PLAN", name: "Plan", color: "bg-blue-500", icon: "📋" },
    { key: "EXECUTE", name: "Execute", color: "bg-green-500", icon: "⚡" },
    { key: "OPTIMIZE", name: "Optimize", color: "bg-purple-500", icon: "🚀" },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                License Inventory
              </CardTitle>
              <CardDescription>
                Your organization's license pool and availability
              </CardDescription>
            </div>
            <Button onClick={() => setShowPurchaseModal(true)}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Purchase Licenses
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {licenseTypes.map((type) => {
              const data = inventory[type.key] || {
                total: 0,
                available: 0,
                assigned: 0,
                suspended: 0,
                expired: 0,
              };

              const usagePercent = data.total > 0 ? (data.assigned / data.total) * 100 : 0;

              return (
                <Card key={type.key} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <CardTitle className="text-sm">{type.name}</CardTitle>
                          <p className="text-xs text-gray-500">License Type</p>
                        </div>
                      </div>
                      <Badge className={type.color + " text-white"}>
                        {data.total}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Usage</span>
                          <span className="font-semibold">
                            {data.assigned}/{data.total}
                          </span>
                        </div>
                        <Progress value={usagePercent} className="h-2" />
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 p-2 bg-green-50 rounded">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <div>
                            <div className="font-semibold text-green-700">
                              {data.available}
                            </div>
                            <div className="text-gray-600">Available</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 p-2 bg-blue-50 rounded">
                          <Users className="h-3 w-3 text-blue-600" />
                          <div>
                            <div className="font-semibold text-blue-700">
                              {data.assigned}
                            </div>
                            <div className="text-gray-600">Assigned</div>
                          </div>
                        </div>
                        {data.suspended > 0 && (
                          <div className="flex items-center gap-1 p-2 bg-orange-50 rounded">
                            <AlertCircle className="h-3 w-3 text-orange-600" />
                            <div>
                              <div className="font-semibold text-orange-700">
                                {data.suspended}
                              </div>
                              <div className="text-gray-600">Suspended</div>
                            </div>
                          </div>
                        )}
                        {data.expired > 0 && (
                          <div className="flex items-center gap-1 p-2 bg-red-50 rounded">
                            <Clock className="h-3 w-3 text-red-600" />
                            <div>
                              <div className="font-semibold text-red-700">
                                {data.expired}
                              </div>
                              <div className="text-gray-600">Expired</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Warning if running low */}
                      {data.available === 0 && data.total > 0 && (
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>No licenses available</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Licenses</DialogTitle>
            <DialogDescription>
              Select the number of licenses to purchase for each type
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {licenseTypes.map((type) => (
              <div key={type.key} className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xl">{type.icon}</span>
                  <Label htmlFor={type.key} className="flex-1">
                    {type.name}
                  </Label>
                </div>
                <Input
                  id={type.key}
                  type="number"
                  min="0"
                  value={purchaseQuantities[type.key]}
                  onChange={(e) =>
                    setPurchaseQuantities({
                      ...purchaseQuantities,
                      [type.key]: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-20"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPurchaseModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
