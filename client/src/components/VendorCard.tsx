import { type Vendor } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorCardProps {
  vendor: Vendor;
  selected?: boolean;
  onSelect: (vendor: Vendor) => void;
}

export function VendorCard({ vendor, selected, onSelect }: VendorCardProps) {
  return (
    <Card
      className={cn(
        "p-4 hover-elevate transition-all cursor-pointer",
        selected && "border-2 border-primary"
      )}
      onClick={() => onSelect(vendor)}
      data-testid={`vendor-card-${vendor.id}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {vendor.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {vendor.address}
            </p>
          </div>
          
          {vendor.rating && (
            <div className="flex items-center gap-1 shrink-0">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{vendor.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>{vendor.distance.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              <span>{vendor.phone}</span>
            </div>
          </div>
          
          <Button
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(vendor);
            }}
            data-testid={`button-select-${vendor.id}`}
          >
            {selected ? "Selected" : "Select"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
