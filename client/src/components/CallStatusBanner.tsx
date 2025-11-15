import { type Call, type CallStatus } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Phone, PhoneCall, PhoneOff, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface CallStatusBannerProps {
  call: Call;
}

const statusConfig: Record<CallStatus, { icon: typeof Phone; label: string; color: string }> = {
  "initiating": { icon: Phone, label: "Initiating call", color: "text-blue-500" },
  "ringing": { icon: PhoneCall, label: "Ringing", color: "text-yellow-500" },
  "in-progress": { icon: PhoneCall, label: "Call in progress", color: "text-green-500" },
  "negotiating": { icon: PhoneCall, label: "Negotiating price", color: "text-purple-500" },
  "completed": { icon: CheckCircle2, label: "Call completed", color: "text-green-600" },
  "failed": { icon: XCircle, label: "Call failed", color: "text-red-500" },
};

export function CallStatusBanner({ call }: CallStatusBannerProps) {
  const [duration, setDuration] = useState(0);
  const config = statusConfig[call.status];
  const Icon = config.icon;
  
  useEffect(() => {
    if (call.status === "in-progress" || call.status === "negotiating") {
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [call.status]);
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <Card 
      className={cn(
        "p-4 border-l-4 animate-in slide-in-from-bottom-2",
        call.status === "in-progress" || call.status === "negotiating" ? "border-l-green-500" : "border-l-primary"
      )}
      data-testid={`call-status-${call.status}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full bg-secondary",
            (call.status === "in-progress" || call.status === "negotiating") && "animate-pulse"
          )}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          
          <div>
            <p className="font-medium text-foreground">{config.label}</p>
            {call.negotiatedPrice && (
              <p className="text-sm text-muted-foreground">
                Negotiated price: ₹{call.negotiatedPrice.toLocaleString()}
              </p>
            )}
          </div>
        </div>
        
        {(call.status === "in-progress" || call.status === "negotiating") && (
          <div className="text-sm font-mono text-muted-foreground">
            {formatDuration(duration)}
          </div>
        )}
        
        {call.duration && call.status === "completed" && (
          <div className="text-sm font-mono text-muted-foreground">
            Duration: {formatDuration(call.duration)}
          </div>
        )}
      </div>
    </Card>
  );
}
