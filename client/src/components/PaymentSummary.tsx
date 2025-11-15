import { type Transaction, type Vendor } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PaymentSummaryProps {
  transaction: Transaction;
  vendor: Vendor;
}

export function PaymentSummary({ transaction, vendor }: PaymentSummaryProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Transaction hash copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };
  
  const statusConfig = {
    pending: { icon: Clock, label: "Pending", color: "bg-yellow-500" },
    processing: { icon: Clock, label: "Processing", color: "bg-blue-500" },
    completed: { icon: CheckCircle2, label: "Completed", color: "bg-green-600" },
    failed: { icon: XCircle, label: "Failed", color: "bg-red-500" },
  };
  
  const StatusIcon = statusConfig[transaction.status].icon;
  
  return (
    <Card className="overflow-hidden" data-testid="payment-summary">
      <CardHeader className="bg-muted/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">Payment Summary</CardTitle>
          <Badge className={statusConfig[transaction.status].color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig[transaction.status].label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Vendor Details */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Vendor Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between py-2">
              <span className="text-sm font-medium">Name</span>
              <span className="text-base">{vendor.name}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm font-medium">Phone</span>
              <span className="text-base font-mono">{vendor.phone}</span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Payment Details */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Payment Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between py-2">
              <span className="text-sm font-medium">Amount</span>
              <span className="text-lg font-semibold">
                {transaction.amount} {transaction.currency}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm font-medium">Created</span>
              <span className="text-base">
                {new Date(transaction.createdAt).toLocaleString()}
              </span>
            </div>
            {transaction.completedAt && (
              <div className="flex justify-between py-2">
                <span className="text-sm font-medium">Completed</span>
                <span className="text-base">
                  {new Date(transaction.completedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Transaction Hashes */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Transaction Details</h4>
          <div className="space-y-3">
            {transaction.locusTransactionHash && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Locus Transaction Hash</span>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <code className="text-xs font-mono flex-1 truncate">
                    {transaction.locusTransactionHash}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyToClipboard(transaction.locusTransactionHash!)}
                    data-testid="button-copy-locus-hash"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    asChild
                  >
                    <a
                      href={`https://basescan.org/tx/${transaction.locusTransactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="link-locus-explorer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
            
            {transaction.stripePayoutId && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">Stripe Payout ID</span>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <code className="text-xs font-mono flex-1 truncate">
                    {transaction.stripePayoutId}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyToClipboard(transaction.stripePayoutId!)}
                    data-testid="button-copy-stripe-id"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
