"use client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
type Filters = {
  sortBy: string;
  filterByAsset: string;
  filterByStatus: string;
};

interface MarketplaceFiltersProps {
  filters: Filters;
  onFiltersChange: (newFilters: Partial<Filters>) => void;
}

export default function MarketplaceFilters({
  filters,
  onFiltersChange,
}: MarketplaceFiltersProps) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort By */}
        <div className="min-w-[150px]">
          <label htmlFor="sortBy" className="sr-only">
            Sort By
          </label>
          <Select
            value={filters.sortBy}
            onValueChange={(v) => onFiltersChange({ sortBy: v })}
          >
            <SelectTrigger size="sm" className="h-8 text-xs">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="CREATED_AT_DESC">Newest First</SelectItem>
              <SelectItem value="CREATED_AT_ASC">Oldest First</SelectItem>
              <SelectItem value="PRICE_AMOUNT_DESC">
                Price: High to Low
              </SelectItem>
              <SelectItem value="PRICE_AMOUNT_ASC">
                Price: Low to High
              </SelectItem>
              <SelectItem value="AMOUNT_DESC">Amount: High to Low</SelectItem>
              <SelectItem value="AMOUNT_ASC">Amount: Low to High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter by Asset */}
        <div className="min-w-[150px]">
          <label htmlFor="filterByAsset" className="sr-only">
            Price Asset
          </label>
          <Input
            type="text"
            value={filters.filterByAsset}
            onChange={(e) =>
              onFiltersChange({ filterByAsset: e.target.value.toUpperCase() })
            }
            placeholder="Asset (FLOW, USDC)"
            className="h-8 text-xs placeholder:text-neutral-500"
          />
        </div>

        {/* Filter by Status */}
        <div className="min-w-[150px]">
          <label htmlFor="filterByStatus" className="sr-only">
            Status
          </label>
          <Select
            value={filters.filterByStatus || "ALL"}
            onValueChange={(v) =>
              onFiltersChange({ filterByStatus: v === "ALL" ? "" : v })
            }
          >
            <SelectTrigger size="sm" className="h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="OPEN">Open Only</SelectItem>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="FILLED">Filled Only</SelectItem>
              <SelectItem value="CANCELLED">Cancelled Only</SelectItem>
              <SelectItem value="EXPIRED">Expired Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
