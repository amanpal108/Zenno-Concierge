import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, ArrowRight, Wallet, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentApprovalProps {
  negotiatedPrice: number;
  vendorName: string;
  vendorPhone: string;
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export function PaymentApproval({
  negotiatedPrice,
  vendorName,
  vendorPhone,
  onApprove,
  onReject,
  isProcessing = false,
}: PaymentApprovalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Calculate fees and totals
  const negotiatedPriceUSD = negotiatedPrice / 83; // Approximate INR to USD conversion
  const offRampingFee = 1; // $1 USD fee for offramping
  const totalUSDC = negotiatedPriceUSD + offRampingFee;
  const walletBalance = 10; // Starting balance in USDC
  const remainingBalance = walletBalance - totalUSDC;

  const handleApprove = () => {
    setIsConfirming(true);
    onApprove();
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card className="border-2 border-primary/20" data-testid="payment-approval-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Payment Approval Required</CardTitle>
          </div>
          <CardDescription>
            Review and approve the payment details before proceeding
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Vendor Details */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Vendor Details</h4>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">{vendorName}</p>
              <p className="text-xs text-muted-foreground">{vendorPhone}</p>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Payment Breakdown</h4>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Negotiated Price</span>
                <span className="font-medium">₹{negotiatedPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>≈ USD Equivalent</span>
                <span>${negotiatedPriceUSD.toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm">Offramping Fee</span>
                <span className="text-sm font-medium">${offRampingFee.toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Total USDC Required</span>
                <span className="font-bold text-primary">${totalUSDC.toFixed(2)} USDC</span>
              </div>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Wallet Status</h4>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Current Balance</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  ${walletBalance.toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">After Payment</span>
                <span className={cn(
                  "font-medium",
                  remainingBalance >= 0 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  ${remainingBalance.toFixed(2)} USDC
                </span>
              </div>
            </div>
          </div>

          {/* Payment Flow */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Payment Flow:</strong> Your USDC will be converted to INR and sent to the vendor's 
              bank account. The offramping fee covers currency conversion and bank transfer costs.
            </AlertDescription>
          </Alert>

          {/* Insufficient Balance Warning */}
          {remainingBalance < 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient balance. You need ${Math.abs(remainingBalance).toFixed(2)} more USDC to complete this payment.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isProcessing || isConfirming}
            className="flex-1"
            data-testid="button-reject-payment"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isProcessing || isConfirming || remainingBalance < 0}
            className="flex-1 gap-2"
            data-testid="button-approve-payment"
          >
            {isProcessing || isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Approve Payment
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Transaction Progress Indicator */}
      {(isProcessing || isConfirming) && (
        <div className="mt-4">
          <Card className="border-dashed">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    "bg-primary animate-pulse"
                  )} />
                  <span className="text-sm text-muted-foreground">Converting USDC</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    "bg-muted"
                  )} />
                  <span className="text-sm text-muted-foreground">Sending to Vendor</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}