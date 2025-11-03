export const typeDefs = /* GraphQL */ `
  scalar JSON

  type Vault {
    network: String!
    vaultId: String!
    collection: String
    tokenId: String
    shareSymbol: String
    policy: String
    creator: String
    createdAt: String
    state: String
    maxSupply: String
    custodyAlive: Boolean!
    nftDisplay: NFTDisplay
  }

  type Buyout {
    network: String!
    vaultId: String!
    proposalId: String!
    proposer: String
    asset: String
    amount: String
    quorumPercent: Int
    supportPercent: Int
    expiresAt: String
    state: String
    forVotes: String
    againstVotes: String
    finalizedAt: String
  }

  type ShareToken {
    network: String!
    symbol: String!
    vaultId: String!
    decimals: Int
    totalSupply: String
    mode: String
    treasury: String
    createdAt: String
  }

  type Balance {
    network: String!
    assetSymbol: String!
    account: String!
    amount: String
    updatedAt: String
  }

  type Listing {
    network: String!
    vaultId: String!
    listingId: String!
    seller: String
    priceAsset: String
    priceAmount: String
    amount: String
    status: String
    createdAt: String
  }

  type AmmFeeParams {
    feeBps: Int!
    vaultSplitBps: Int!
    protocolSplitBps: Int!
  }

  enum ListingStatus {
    OPEN
    FILLED
    CANCELLED
    EXPIRED
  }

  enum MarketplaceSortBy {
    CREATED_AT_DESC
    CREATED_AT_ASC
    PRICE_AMOUNT_DESC
    PRICE_AMOUNT_ASC
    AMOUNT_DESC
    AMOUNT_ASC
  }

  type MarketplaceListing {
    network: String!
    vaultId: String!
    listingId: String!
    seller: String
    priceAsset: String
    priceAmount: String
    amount: String
    status: String
    createdAt: String
    vaultSymbol: String
    vaultName: String
  }

  type MarketplaceListingsResponse {
    listings: [MarketplaceListing!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  type MarketplaceStats {
    totalListings: Int!
    openListings: Int!
    totalVolume: String!
    openVolume: String!
    uniqueAssets: Int!
    uniqueVaults: Int!
  }

  type Pool {
    network: String!
    vaultId: String!
    poolId: String!
    owner: String
    assetA: String
    assetB: String
    reserveA: String
    reserveB: String
    feeBps: Int
    createdAt: String
  }

  type PoolByAssetEntry {
    network: String!
    assetSymbol: String!
    poolId: String!
    vaultId: String!
    owner: String
    otherAsset: String
    reserveSelf: String
    reserveOther: String
    feeBps: Int
    createdAt: String
  }

  type Distribution {
    network: String!
    vaultId: String!
    programId: String!
    asset: String
    totalAmount: String
    schedule: String
    startsAt: String
    endsAt: String
    createdAt: String
  }

  type Claim {
    network: String!
    programId: String!
    account: String!
    amount: String
    claimedAt: String
  }

  type DistributionRecipient {
    account: String!
    amount: String!
    createdAt: String
  }

  type PriceTVL {
    symbol: String!
    quoteSymbol: String!
    price: String
    tvl: String
    poolId: String
    vaultId: String
    feeBps: Int
  }

  type Availability {
    available: Boolean!
  }

  type Event {
    network: String!
    vaultId: String!
    blockHeight: String!
    txIndex: Int!
    evIndex: Int!
    txId: String!
    type: String!
    payload: String
    ts: String
  }

  type FeeEvent {
    network: String!
    vaultId: String!
    kind: String!
    token: String!
    amount: String!
    vaultShare: String!
    protocolShare: String!
    payer: String!
    txId: String!
    createdAt: String!
  }

  type Query {
    ammFeeParams(network: String!, vaultId: String!): AmmFeeParams
    vault(network: String!, vaultId: String!): Vault
    vaults(network: String!, limit: Int = 50, cursor: String): [Vault!]
    vaultBySymbol(network: String!, symbol: String!): Vault
    vaultsByCreator(
      network: String!
      creator: String!
      limit: Int = 50
    ): [Vault!]
    exampleNFTIds(network: String!, account: String!): [String!]
    nftCollections(network: String!, account: String!): [NFTCollection!]
    nftStorageCollections(
      network: String!
      account: String!
    ): [NFTStorageCollection!]
    collectionIds(
      network: String!
      account: String!
      publicPath: String!
    ): [String!]
    # Convenience: direct NFT display resolution
    nftDisplay(
      network: String!
      account: String!
      publicPath: String!
      tokenId: String!
    ): NFTDisplay
    buyouts(network: String!, vaultId: String!, limit: Int = 50): [Buyout!]
    shareToken(network: String!, symbol: String!): ShareToken
    listings(network: String!, vaultId: String!, limit: Int = 50): [Listing!]
    listingsBySeller(
      network: String!
      seller: String!
      limit: Int = 50
    ): [Listing!]
    listing(network: String!, vaultId: String!, listingId: String!): Listing
    # Marketplace queries for browsing all listings
    marketplaceListings(
      network: String!
      limit: Int = 50
      offset: Int = 0
      sortBy: MarketplaceSortBy = CREATED_AT_DESC
      filterByAsset: String
      filterByStatus: ListingStatus
    ): MarketplaceListingsResponse!
    marketplaceStats(network: String!): MarketplaceStats!
    pools(network: String!, vaultId: String!, limit: Int = 50): [Pool!]
    allPools(
      network: String!
      limit: Int = 50
      offset: Int = 0
      filterActive: Boolean
      filterByAsset: String
      sortBy: String
    ): [Pool!]
    pool(network: String!, vaultId: String!, poolId: String!): Pool
    poolsByAsset(
      network: String!
      assetSymbol: String!
      limit: Int = 50
    ): [PoolByAssetEntry!]
    distributions(
      network: String!
      vaultId: String!
      limit: Int = 50
    ): [Distribution!]
    claims(network: String!, programId: String!, limit: Int = 100): [Claim!]
    distributionRecipients(
      network: String!
      programId: String!
    ): [DistributionRecipient!]
    events(network: String!, vaultId: String!, limit: Int = 50): [Event!]
    balancesByAsset(
      network: String!
      assetSymbol: String!
      limit: Int = 100
    ): [Balance!]
    holdersByAsset(
      network: String!
      assetSymbol: String!
      limit: Int = 100
    ): [Balance!]
    priceTvl(network: String!, symbol: String!, quoteSymbol: String): PriceTVL
    balancesByAccount(
      network: String!
      account: String!
      limit: Int = 100
    ): [Balance!]
    shareBalance(
      network: String!
      vaultId: String!
      account: String!
    ): ShareBalance!
    vaultMaxSupply(network: String!, vaultId: String!): String
    vaultTotalSupply(network: String!, vaultId: String!): String
    feeParams(network: String!, vaultId: String!): FeeParams
    quoteWithFees(
      network: String!
      priceAmount: String!
      vaultId: String!
    ): Quote
    # AMM quote: compute out amount for a given pool and direction
    ammQuote(
      network: String!
      poolOwner: String!
      poolId: String!
      direction: String! # "share_to_flow" | "flow_to_share"
      amountIn: String!
    ): QuoteOut!
    # AMM quote with platform fee and split breakdown
    ammQuoteWithFees(
      network: String!
      poolOwner: String!
      poolId: String!
      direction: String!
      amountIn: String!
      vaultId: String!
    ): QuoteWithFees!
    fees(network: String!, vaultId: String!, limit: Int = 25): [FeeEvent!]
    pendingFeeParams(network: String!, vaultId: String!): PendingFeeParams
    feeSchedule(network: String!, vaultId: String!): FeeSchedule

    # Read from the db (indexed events) and may be 'out of sync'
    feeTotals(network: String!, token: String!): FeeTotals

    # Fetched from the FlowToken vault balance (platform admin account in current design)
    # We may choose to use this later, or to help when things go out of sync.
    platformFeesBalance(network: String!): String!
    # Platform treasury FLOW balance
    platformTreasuryBalance(network: String!): String!
    # Vault treasury FLOW balance (per-vault treasury stored under admin)
    vaultTreasuryBalance(network: String!, vaultId: String!): String!
    # Vault treasury share balance (per-vault treasury for distributions)
    vaultTreasuryShareBalance(network: String!, vaultId: String!): String!
    # Server-side convenience: admin share escrow balance for a vault's FT
    vaultEscrowBalance(network: String!, vaultId: String!): String!

    # Circulating supply components and aggregate
    vaultLockedSeedShares(network: String!, vaultId: String!): String!
    vaultTeamShareBalances(network: String!, vaultId: String!): String!
    vaultTeamLPShareEquivalent(network: String!, vaultId: String!): String!
    vaultCirculating(network: String!, vaultId: String!): String!

    # NFT metadata views (Display)
    vaultNftDisplay(network: String!, vaultId: String!): NFTDisplay

    # Availability checks
    symbolAvailable(network: String!, symbol: String!): Availability!
    vaultIdAvailable(network: String!, vaultId: String!): Availability!
  }

  type NFTCollection {
    publicPath: String!
    typeId: String!
    storagePath: String
  }

  type NFTStorageCollection {
    storagePath: String!
    typeId: String!
  }

  type ShareTx {
    cadence: String!
    limit: Int!
    args: [ShareTxArg!]!
  }

  type ShareTxArg {
    type: String!
    value: String!
  }

  type ShareBalance {
    balance: String!
  }

  type TxResult {
    txId: String!
  }

  type FeeParams {
    feeBps: Int!
    vaultSplitBps: Int!
    protocolSplitBps: Int!
  }

  type Quote {
    priceAmount: String!
    feeAmount: String!
    totalPay: String!
    feeBps: Int!
  }

  type QuoteOut {
    in: String!
    out: String!
  }

  type QuoteWithFees {
    in: String!
    out: String!
    feeAmount: String!
    feeBps: Int!
    vaultShare: String!
    protocolShare: String!
  }

  type PendingFeeParams {
    feeBps: Int!
    vaultSplitBps: Int!
    protocolSplitBps: Int!
    effectiveAt: String!
  }

  type FeeSchedule {
    current: FeeParams
    pending: PendingFeeParams
  }

  type FeeTotals {
    token: String!
    amountTotal: String!
    vaultTotal: String!
    protocolTotal: String!
    updatedAt: String!
  }

  type NFTDisplay {
    name: String
    description: String
    thumbnail: String
  }

  type Mutation {
    # Admin-only: register vault after client deposited NFT to custody
    registerVaultFromNFT(
      network: String!
      vaultId: String!
      collectionStoragePath: String!
      collectionPublicPath: String!
      tokenId: String!
      shareSymbol: String!
      policy: String!
      creator: String!
    ): TxResult!
    setTransferMode(network: String!, symbol: String!, mode: String!): TxResult!
    redeem(network: String!, vaultId: String!): TxResult!
    setVaultMaxSupply(
      network: String!
      vaultId: String!
      maxSupply: String!
    ): TxResult!
    mintShares(
      network: String!
      vaultId: String!
      recipient: String!
      amount: String!
    ): TxResult!
    mintSharesToTreasury(
      network: String!
      vaultId: String!
      amount: String!
    ): TxResult!
    scheduleDistribution(
      network: String!
      vaultId: String!
      programId: String!
      asset: String!
      totalAmount: String!
      schedule: String!
      startsAt: String!
      endsAt: String!
    ): TxResult!
    finalizeBuyout(
      network: String!
      vaultId: String!
      proposalId: String!
      result: String!
    ): TxResult!
    claimPayout(
      network: String!
      programId: String!
      amount: String!
    ): TxResult!
    # Removed: client now performs custody deposit; server registers via registerVaultFromNFT
    cancelListing(
      network: String!
      vaultId: String!
      listingId: String!
    ): TxResult!
      @deprecated(
        reason: "Use client-side Actions transactions from the web UI"
      )
    fillListing(
      network: String!
      vaultId: String!
      listingId: String!
      buyer: String!
    ): TxResult!
      @deprecated(
        reason: "Use client-side Actions transactions from the web UI"
      )
    fillListingSettle(
      network: String!
      vaultId: String!
      listingId: String!
      buyer: String!
    ): TxResult! @deprecated(reason: "Replaced by client-side Actions flow")
    expireListing(
      network: String!
      vaultId: String!
      listingId: String!
    ): TxResult!
      @deprecated(
        reason: "Use client-side Actions transactions from the web UI"
      )
    setupCustody(network: String!): TxResult!
    mintExampleNFT(
      network: String!
      recipient: String!
      name: String
      description: String
      thumbnail: String
    ): TxResult!
    configureShareSupply(
      network: String!
      vaultId: String!
      maxSupply: String
      escrowAmount: String
      escrowRecipient: String
    ): ShareSupplyResult!
    scheduleFeeActivation(network: String!, vaultId: String!): TxResult!
    scheduleFeeParams(
      network: String!
      vaultId: String!
      feeBps: Int!
      vaultSplitBps: Int!
      protocolSplitBps: Int!
      effectiveAt: String!
    ): TxResult!

    ensureVaultTreasury(network: String!, vaultId: String!): TxResult!

    # Buyer-only payment is client-side; server settles escrowed shares to buyer and marks listing filled
    settleListing(
      network: String!
      vaultId: String!
      listingId: String!
      buyer: String!
      symbol: String!
      shareAmount: String!
      priceAmount: String!
      seller: String!
    ): TxResult!

    # Removed: user-driven AMM seeding is client-signed via wallet AddLiquidity
  }

  type ShareSupplyResult {
    maxSupplyTxId: String
    mintTxId: String
  }
`;

export default typeDefs;
