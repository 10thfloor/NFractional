export type Listing = {
  network: string;
  vaultId: string;
  listingId: string;
  seller?: string | null;
  priceAsset?: string | null;
  priceAmount?: string | null;
  amount?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export type PreparedTxArg = {
  type: "Address" | "String" | "UFix64";
  value: string;
};

export type PreparedTxPayload = {
  cadence: string;
  args: PreparedTxArg[];
  limit: number;
};

export type ShareTokenMeta = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  totalSupply?: string;
  maxSupply?: string | null;
  contractName: string;
};
