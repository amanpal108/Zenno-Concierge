import { type JourneyStatus } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Search, Phone, CreditCard, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface JourneyTimelineProps {
  currentStatus: JourneyStatus;
}

const steps = [
  { id: "chatting", label: "Chat with Zenno", icon: MessageSquare },
  { id: "searching-vendors", label: "Find Vendors", icon: Search },
  { id: "selecting-vendor", label: "Select Vendor", icon: CheckCircle2 },
  { id: "calling-vendor", label: "Negotiate Call", icon: Phone },
  { id: "processing-payment", label: "Process Payment", icon: CreditCard },
  { id: "completed", label: "Complete", icon: CheckCircle2 },
] as const;

export function JourneyTimeline({ currentStatus }: JourneyTimelineProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStatus);
  
  return (
    <Card data-testid="journey-timeline">
      <CardHeader>
        <CardTitle className="text-lg">Purchase Journey</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;
            
            return (
              <div
                key={step.id}
                className="flex items-start gap-4 relative"
                data-testid={`timeline-step-${step.id}`}
              >
                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-5 top-10 w-0.5 h-8",
                      isCompleted || isCurrent ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-primary/10 border-primary text-primary animate-pulse",
                    isUpcoming && "bg-background border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                
                {/* Label */}
                <div className="flex-1 pt-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCompleted && "text-foreground",
                      isCurrent && "text-primary font-semibold",
                      isUpcoming && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-muted-foreground mt-1">In progress...</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
