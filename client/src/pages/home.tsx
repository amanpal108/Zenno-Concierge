import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Message, type Vendor, type Session, type ChatRequest } from "@shared/schema";
import { ChatMessage } from "@/components/ChatMessage";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { VendorCarousel } from "@/components/VendorCarousel";
import { CallStatusBanner } from "@/components/CallStatusBanner";
import { PaymentSummary } from "@/components/PaymentSummary";
import { JourneyTimeline } from "@/components/JourneyTimeline";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Fetch session data
  const { data: session, isLoading: isLoadingSession } = useQuery<Session>({
    queryKey: ["/api/session", sessionId],
    enabled: !!sessionId,
    refetchInterval: 3000, // Poll every 3 seconds for updates
    queryFn: async () => {
      const response = await fetch(`/api/session/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch session");
      }
      return response.json();
    },
  });
  
  // Update local state when session data changes
  useEffect(() => {
    if (session) {
      setMessages(session.messages || []);
      setVendors(session.vendors || []);
      setSelectedVendor(session.selectedVendor);
    }
  }, [session?.messages, session?.vendors, session?.selectedVendor]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const request: ChatRequest = {
        message,
        sessionId: sessionId ?? undefined,
      };
      const response = await apiRequest("POST", "/api/chat", request);
      return await response.json();
    },
    onSuccess: async (data) => {
      console.log("Chat response received:", data);
      
      // Ensure we have a sessionId
      if (!data.sessionId) {
        console.error("No sessionId in response:", data);
        toast({
          title: "Error",
          description: "Failed to create session. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Set sessionId first if it's a new session
      const isNewSession = !sessionId;
      if (isNewSession) {
        console.log("Setting new sessionId:", data.sessionId);
        setSessionId(data.sessionId);
      }
      
      // Immediately fetch the full session to get all messages
      try {
        console.log("Fetching session:", data.sessionId);
        const response = await fetch(`/api/session/${data.sessionId}`);
        if (response.ok) {
          const freshSession = await response.json();
          console.log("Session fetched:", freshSession);
          setMessages(freshSession.messages || []);
          setVendors(freshSession.vendors || []);
          setSelectedVendor(freshSession.selectedVendor);
        } else {
          console.error("Failed to fetch session, status:", response.status);
        }
      } catch (error) {
        console.error("Failed to fetch session after message:", error);
      }
      
      // Only invalidate query cache if session already exists (for subsequent polls)
      // For new sessions, the query will start automatically when sessionId is set
      if (!isNewSession) {
        queryClient.invalidateQueries({ queryKey: ["/api/session", data.sessionId] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });
  
  // Select vendor mutation
  const selectVendorMutation = useMutation({
    mutationFn: async (vendor: Vendor) => {
      if (!sessionId) throw new Error("No active session");
      const response = await apiRequest("POST", "/api/vendors/select", {
        sessionId,
        vendorId: vendor.id,
      });
      const result = await response.json();
      
      // Automatically initiate call after vendor selection
      try {
        const callResponse = await apiRequest("POST", "/api/calls/initiate", {
          sessionId,
          vendorId: vendor.id,
          userBudget: 10000, // Default budget ₹10,000
        });
        await callResponse.json();
      } catch (callError) {
        console.error("Call initiation failed:", callError);
      }
      
      return result;
    },
    onSuccess: (data, vendor) => {
      queryClient.invalidateQueries({ queryKey: ["/api/session", sessionId] });
      toast({
        title: "Vendor Selected",
        description: `Calling ${vendor.name} to negotiate price...`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to select vendor",
        variant: "destructive",
      });
    },
  });
  
  // Automatically process payment when call completes
  useEffect(() => {
    if (
      session?.currentCall?.status === "completed" &&
      session?.currentCall?.negotiatedPrice &&
      session?.selectedVendor &&
      !session?.transaction
    ) {
      // Auto-initiate payment
      const processPayment = async () => {
        try {
          const response = await apiRequest("POST", "/api/payments/process", {
            sessionId: session.id,
            amount: session.currentCall!.negotiatedPrice!,
            vendorPhone: session.selectedVendor!.phone,
          });
          await response.json();
          queryClient.invalidateQueries({ queryKey: ["/api/session", sessionId] });
          toast({
            title: "Payment Processing",
            description: "Your payment is being processed...",
          });
        } catch (error: any) {
          toast({
            title: "Payment Error",
            description: error.message || "Failed to process payment",
            variant: "destructive",
          });
        }
      };
      processPayment();
    }
  }, [session?.currentCall?.status, session?.currentCall?.negotiatedPrice, sessionId]);
  
  const handleSendMessage = (message: string) => {
    sendMessageMutation.mutate(message);
  };
  
  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    selectVendorMutation.mutate(vendor);
  };
  
  const SidebarContent = () => (
    <div className="space-y-6">
      {session?.journeyStatus && (
        <JourneyTimeline currentStatus={session.journeyStatus} />
      )}
      
      {session?.transaction && selectedVendor && (
        <PaymentSummary
          transaction={session.transaction}
          vendor={selectedVendor}
        />
      )}
    </div>
  );
  
  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-80 xl:w-96 border-r border-border overflow-y-auto">
        <div className="p-6 sticky top-0 bg-background border-b border-border z-10">
          <h2 className="text-lg font-semibold">Purchase Details</h2>
        </div>
        <div className="p-6">
          <SidebarContent />
        </div>
      </aside>
      
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-background sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="outline" size="icon" data-testid="button-sidebar-toggle">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Purchase Details</h2>
                </div>
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Zenno Concierge</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Your AI Shopping Assistant</p>
              </div>
            </div>
          </div>
        </header>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-6">
            {messages.length === 0 && !isLoadingSession ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-center">
                  Welcome to Zenno Concierge
                </h2>
                <p className="text-muted-foreground text-center max-w-md mb-8">
                  I'm your AI shopping assistant. I'll help you find the perfect Banarasi saree, 
                  negotiate with vendors, and complete your purchase seamlessly.
                </p>
                <div className="grid gap-3 w-full max-w-md">
                  <Button
                    variant="outline"
                    className="justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleSendMessage("I'm looking for a Banarasi saree")}
                    data-testid="button-quick-start"
                  >
                    <span className="text-sm">I'm looking for a Banarasi saree</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start text-left h-auto py-3 px-4"
                    onClick={() => handleSendMessage("Find me the best silk saree vendors")}
                    data-testid="button-quick-vendors"
                  >
                    <span className="text-sm">Find me the best silk saree vendors</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                
                {/* Show vendor carousel when in selecting-vendor stage */}
                {session?.journeyStatus === "selecting-vendor" && vendors.length > 0 && (
                  <div className="px-4 sm:px-6 my-4">
                    <VendorCarousel
                      vendors={vendors}
                      selectedVendor={selectedVendor}
                      onSelectVendor={handleSelectVendor}
                    />
                  </div>
                )}
                
                {sendMessageMutation.isPending && <TypingIndicator />}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>
        
        {/* Call Status Banner */}
        {session?.currentCall && (
          <div className="px-4 sm:px-6 pb-4">
            <div className="max-w-4xl mx-auto">
              <CallStatusBanner call={session.currentCall} />
            </div>
          </div>
        )}
        
        {/* Chat Input */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={sendMessageMutation.isPending}
          placeholder={
            session?.journeyStatus === "completed"
              ? "Transaction complete! Start a new conversation..."
              : "Type your message..."
          }
        />
      </main>
    </div>
  );
}
