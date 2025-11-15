import { type Message } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  
  return (
    <div
      className={cn(
        "flex gap-4 px-6 py-4",
        isUser ? "justify-end" : "justify-start"
      )}
      data-testid={`message-${message.role}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "rounded-2xl px-6 py-4",
          isUser
            ? "bg-primary text-primary-foreground max-w-2xl"
            : "bg-card text-card-foreground max-w-3xl border border-card-border"
        )}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <span className="text-xs opacity-70 mt-2 block">
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
      
      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
