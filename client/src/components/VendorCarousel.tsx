import { useState, useRef } from "react";
import { type Vendor } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Phone, ChevronLeft, ChevronRight, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorCarouselProps {
  vendors: Vendor[];
  selectedVendor?: Vendor;
  onSelectVendor: (vendor: Vendor) => void;
}

export function VendorCarousel({ vendors, selectedVendor, onSelectVendor }: VendorCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollTo = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320; // Width of one vendor card
      const currentScroll = scrollContainerRef.current.scrollLeft;
      const newScroll = direction === "left" 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      scrollContainerRef.current.scrollTo({
        left: newScroll,
        behavior: "smooth",
      });
      
      setTimeout(checkScrollButtons, 300);
    }
  };

  if (vendors.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4" data-testid="vendor-carousel">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Store className="h-5 w-5" />
          <h3 className="text-base font-semibold">Available Saree Vendors</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Found {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} near you. Select one to start negotiation.
        </p>
      </div>

      {/* Carousel Container */}
      <div className="relative">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/95 backdrop-blur-sm shadow-md hover-elevate"
            onClick={() => scrollTo("left")}
            data-testid="button-carousel-left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && vendors.length > 2 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/95 backdrop-blur-sm shadow-md hover-elevate"
            onClick={() => scrollTo("right")}
            data-testid="button-carousel-right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollButtons}
          className="overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-3 pb-2">
            {vendors.map((vendor) => (
              <Card
                key={vendor.id}
                className={cn(
                  "flex-none w-[300px] hover-elevate transition-all cursor-pointer",
                  selectedVendor?.id === vendor.id && "ring-2 ring-primary ring-offset-2"
                )}
                onClick={() => onSelectVendor(vendor)}
                data-testid={`vendor-carousel-card-${vendor.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Vendor Name and Rating */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">
                          {vendor.name}
                        </h4>
                      </div>
                      {vendor.rating && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{vendor.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Address */}
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {vendor.address}
                    </p>

                    {/* Details */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{vendor.distance.toFixed(1)} km</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{vendor.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Select Button */}
                    <Button
                      size="sm"
                      variant={selectedVendor?.id === vendor.id ? "default" : "outline"}
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVendor(vendor);
                      }}
                      data-testid={`button-select-vendor-${vendor.id}`}
                    >
                      {selectedVendor?.id === vendor.id ? "✓ Selected" : "Select & Call"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}