// Type definitions for Flow Client Library (FCL) types
// These types help avoid 'any' usage when working with FCL query/mutate
// Note: FCL's internal types are complex, so we use unknown for maximum compatibility

export type FclArgFn = (value: unknown, type: unknown) => unknown;
export type FclType = unknown; // FCL's type system is complex, using unknown for compatibility

export type FclQueryInput = {
  cadence: string;
  args?: (arg: FclArgFn, t: FclType) => unknown[];
};

export type FclMutateInput = {
  cadence: string;
  args?: (arg: FclArgFn, t: FclType) => unknown[];
  authorizations?: unknown[];
  limit?: number;
};

export type FclClient = {
  query: (input: FclQueryInput) => Promise<unknown>;
  mutate: (input: FclMutateInput) => Promise<string>;
  /**
   * @deprecated Use websocket-based waitForTransactionSealed from @/lib/tx/utils instead
   * This polling-based method is less efficient than websocket subscriptions
   */
  tx: (id: string) => { onceSealed: () => Promise<void> };
  currentUser: () => { authorization: unknown };
};

