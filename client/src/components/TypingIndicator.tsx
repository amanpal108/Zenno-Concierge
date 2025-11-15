import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-4 px-6 py-4 justify-start" data-testid="typing-indicator">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      
      <div className="rounded-2xl px-6 py-4 bg-card border border-card-border">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
