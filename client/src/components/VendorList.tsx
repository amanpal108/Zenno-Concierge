import { type Vendor } from "@shared/schema";
import { VendorCard } from "./VendorCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VendorListProps {
  vendors: Vendor[];
  selectedVendor?: Vendor;
  onSelectVendor: (vendor: Vendor) => void;
}

export function VendorList({ vendors, selectedVendor, onSelectVendor }: VendorListProps) {
  if (vendors.length === 0) {
    return null;
  }
  
  return (
    <Card data-testid="vendor-list">
      <CardHeader>
        <CardTitle className="text-lg">Available Vendors</CardTitle>
        <p className="text-sm text-muted-foreground">
          {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} found near you
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              selected={selectedVendor?.id === vendor.id}
              onSelect={onSelectVendor}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
