import "NonFungibleToken"
import "ViewResolver"

access(all) contract Fractional {

    // Listing fee defaults (used when a vault has no explicit schedule)
    access(all) let DEFAULT_LISTING_FEE_BPS: UInt64;
    access(all) let DEFAULT_LISTING_VAULT_SPLIT_BPS: UInt64;
    access(all) let DEFAULT_LISTING_PROTOCOL_SPLIT_BPS: UInt64;

  
    // Public paths for fee activation capability (admin publishes an instance of FeeActivator)
    access(all) let FeeActivatorStoragePath: StoragePath
    access(all) let FeeActivatorPublicPath: PublicPath
    // Public path to expose read-only custody access for metadata views
    access(all) let CustodyPublicPath: PublicPath
    // Public path for user-owned LockBox custody (view-only interface)
    access(all) let LockBoxPublicPath: PublicPath

    /// Legacy struct used for SharesMinted event.
    /// Shares are now managed via VaultShareToken contracts, but this event is kept
    /// for backwards compatibility with indexers and analytics.
    access(all) struct Mint {
        access(all) let account: Address
        access(all) let amount: UFix64

        access(all) init(account: Address, amount: UFix64) {
            self.account = account
            self.amount = amount
        }
    }

    // Core events
    access(all) event VaultCreated(vaultId: String, collection: String, tokenId: UInt64, shareSymbol: String, policy: String, creator: Address)

    /// LEGACY EVENT: Share minting now happens via VaultShareToken.TokensMinted.
    /// This event is emitted by admin wrappers for backwards compatibility with indexers.
    access(all) event SharesMinted(symbol: String, mints: [Mint])

    /// LEGACY EVENT: Share transfers now happen via FungibleToken standard.
    /// This event is emitted by admin wrappers for backwards compatibility with indexers.
    access(all) event Transfer(symbol: String, from: Address, to: Address, amount: UFix64)

    access(all) event TransferModeChanged(symbol: String, mode: String)
    access(all) event Redeemed(vaultId: String)

    /// Event for maxSupply metadata updates.
    /// Note: Actual maxSupply enforcement happens at the VaultShareToken contract level.
    /// This tracks the metadata value stored in Fractional.Vault.
    access(all) event MaxSupplySet(vaultId: String, maxSupply: UFix64)

    // Buyout events
    access(all) event BuyoutProposed(vaultId: String, proposalId: String, proposer: Address, asset: String, amount: UFix64, quorumPercent: UInt64, supportPercent: UInt64, expiresAt: UInt64)
    access(all) event BuyoutVoted(vaultId: String, proposalId: String, forVotes: UFix64, againstVotes: UFix64)
    access(all) event BuyoutFinalized(vaultId: String, proposalId: String, result: String)

    // Distribution and payout
    access(all) event DistributionScheduled(vaultId: String, programId: String, asset: String, totalAmount: UFix64, schedule: String, startsAt: UInt64, endsAt: UInt64)
    access(all) event PayoutClaimed(programId: String, account: Address, amount: UFix64)

    // Listings/Marketplace
    access(all) event ListingCreated(vaultId: String, listingId: String, seller: Address, priceAsset: String, priceAmount: UFix64, amount: UFix64)
    access(all) event ListingFilled(vaultId: String, listingId: String)
    access(all) event ListingCancelled(vaultId: String, listingId: String)
    access(all) event ListingExpired(vaultId: String, listingId: String)

    // Fees & Treasury routing (analytics-only; token movements happen in transactions)
    access(all) event FeeParamsSet(vaultId: String, feeBps: UInt64, vaultSplitBps: UInt64, protocolSplitBps: UInt64)
    access(all) event FeeAccrued(
        vaultId: String,
        kind: String,
        token: String,
        amount: UFix64,
        vaultShare: UFix64,
        protocolShare: UFix64,
        payer: Address
    )
    access(all) event FeeParamsProposed(vaultId: String, feeBps: UInt64, vaultSplitBps: UInt64, protocolSplitBps: UInt64, effectiveAt: UInt64)
    access(all) event FeeParamsActivated(vaultId: String)

    // AMM/Pool
    access(all) event PoolCreated(vaultId: String, poolId: String, assetA: String, assetB: String, reserveA: UFix64, reserveB: UFix64, feeBps: UInt64)
    access(all) event LiquidityAdded(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64)
    access(all) event LiquidityRemoved(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64)
    access(all) event Swap(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64)

    // Underlying custody lifecycle
    access(all) event UnderlyingDeposited(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64, nftType: String)
    access(all) event UnderlyingWithdrawn(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64)
    access(all) event UnderlyingBurned(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64)

    access(all) struct Vault {
        access(all) let vaultId: String
        access(all) let collection: String
        access(all) let tokenId: UInt64
        access(all) let shareSymbol: String
        access(all) var policy: String
        access(all) let creator: Address
        access(all) var state: String
        access(all) var mode: String
        /// maxSupply is stored here for metadata/tracking and passed to VaultShareToken at initialization.
        /// Actual supply tracking and enforcement happen at the VaultShareToken contract level.
        access(all) var maxSupply: UFix64?
        access(all) let collectionStoragePath: String
        access(all) let collectionPublicPath: String
        access(all) let custodian: Address

        access(all) init(
            vaultId: String,
            collection: String,
            tokenId: UInt64,
            shareSymbol: String,
            policy: String,
            creator: Address,
            collectionStoragePath: String,
            collectionPublicPath: String,
            custodian: Address
        ) {
            self.vaultId = vaultId
            self.collection = collection
            self.tokenId = tokenId
            self.shareSymbol = shareSymbol
            self.policy = policy
            self.creator = creator
            self.state = "open"
            self.mode = "open"
            self.maxSupply = nil
            self.collectionStoragePath = collectionStoragePath
            self.collectionPublicPath = collectionPublicPath
            self.custodian = custodian
        }

        access(contract) fun setMode(_ m: String) {
            self.mode = m
        }

        access(contract) fun setState(_ s: String) {
            self.state = s
        }

        access(contract) fun setMaxSupply(_ m: UFix64) {
            self.maxSupply = m
        }
        // NOTE: FT configuration is tracked at contract level for backward compatibility
    }

    access(self) var vaults: {String: Vault}
    access(self) var symbolToVault: {String: String}
    
    // Per-vault FT registry (address, name, and path identifiers), stored outside Vault struct
    access(self) var vaultFTAddress: {String: Address}
    access(self) var vaultFTContractName: {String: String}
    access(self) var vaultFTVaultStoragePathIdentifier: {String: String}
    access(self) var vaultFTReceiverPublicPathIdentifier: {String: String}
    access(self) var vaultFTBalancePublicPathIdentifier: {String: String}
    access(self) var adminIssued: Bool
    
    /// Listings lifecycle is tracked with a lightweight index only.
    /// Funds and share movements are handled externally (Actions) in the transaction.
    /// `openListings[vaultId][listingId] == true` means open; absence or false means not open.
    /// `listingSeller[vaultId][listingId]` stores seller for integrity checks and tx routing.
    access(self) var openListings: {String: {String: Bool}}
    access(self) var listingSeller: {String: {String: Address}}
    // Allowlist of acceptable price assets (by symbol or canonical identifier)
    access(self) var allowedPriceAssets: {String: Bool}
    // Shares are always FT-based now. Escrow is performed by transactions using Actions.

    // Per-vault fee parameters (basis points)
    access(self) var feeBps: {String: UInt64}
    access(self) var feeSplitVaultBps: {String: UInt64}
    access(self) var feeSplitProtocolBps: {String: UInt64}
    // Pending (scheduled) fee parameters with activation height/timestamp
    access(self) var pendingFeeBps: {String: UInt64}
    access(self) var pendingFeeSplitVaultBps: {String: UInt64}
    access(self) var pendingFeeSplitProtocolBps: {String: UInt64}
    access(self) var pendingFeeEffectiveAt: {String: UInt64}

    // AMM fee parameters per vault (separate from listing fees)
    access(self) var ammFeeBps: {String: UInt64}
    access(self) var ammFeeSplitVaultBps: {String: UInt64}
    access(self) var ammFeeSplitProtocolBps: {String: UInt64}

    // Custody resource lives under user accounts; holds underlying NFT by vaultId
    access(all) resource interface CustodyPublic {
        view access(all) fun borrowViewResolver(vaultId: String): &{ViewResolver.Resolver}?
    }

    access(all) resource Custody: CustodyPublic {
        access(self) var holdings: @{String: {NonFungibleToken.NFT, ViewResolver.Resolver}}

        access(all) fun deposit(vaultId: String, nft: @{NonFungibleToken.NFT}) {
            pre { self.holdings[vaultId] == nil: "already held" }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let owner: Address = self.owner?.address ?? panic("unknown owner")
            // Validate custodian has expected collection caps
            let pubPath: PublicPath = PublicPath(identifier: v.collectionPublicPath)!
            let pubCap: Capability<&{NonFungibleToken.CollectionPublic}> = getAccount(owner).capabilities.get<&{NonFungibleToken.CollectionPublic}>(pubPath)
            if !pubCap.check() { panic("custodian collection public cap missing or wrong type") }
            // Cast to preserve ViewResolver interface and validate token id
            var toStore: @{NonFungibleToken.NFT, ViewResolver.Resolver}? <- nil
            let nftWithResolver: @{NonFungibleToken.NFT, ViewResolver.Resolver} <- nft as! @{NonFungibleToken.NFT, ViewResolver.Resolver}
            if nftWithResolver.id != v.tokenId {
                destroy nftWithResolver
                panic("tokenId mismatch for vault")
            } else {
                toStore <-! nftWithResolver
            }
            self.holdings[vaultId] <-! toStore!
        }

        access(all) fun withdraw(vaultId: String): @{NonFungibleToken.NFT} {    
            pre { self.holdings[vaultId] != nil: "not held" }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            if v.state != "redeemed" { panic("vault not redeemed") }
            if self.owner?.address != v.custodian { panic("not custodian") }
            let r <- self.holdings.remove(key: vaultId)!
            return <- r
        }

        // Read-only access to the NFT's ViewResolver for UI/metadata
        view access(all) fun borrowViewResolver(vaultId: String): &{ViewResolver.Resolver}? {
            return &self.holdings[vaultId] as &{ViewResolver.Resolver}?
        }

        access(all) init() { self.holdings <- {} }
    }

    // LockBox: user-owned custody with protocol-gated withdraw
    access(all) resource interface LockBoxPublic {
        view access(all) fun borrowViewResolver(vaultId: String): &{ViewResolver.Resolver}?
    }

    access(all) resource LockBox: LockBoxPublic {
        access(self) var holdings: @{String: {NonFungibleToken.NFT, ViewResolver.Resolver}}

        access(all) fun deposit(vaultId: String, nft: @{NonFungibleToken.NFT}) {
            pre { self.holdings[vaultId] == nil: "already held" }
            // Validate vault exists and tokenId matches expected
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let owner: Address = self.owner?.address ?? panic("unknown owner")
            // Validate custodian has expected collection caps
            let pubPath: PublicPath = PublicPath(identifier: v.collectionPublicPath)!
            let pubCap: Capability<&{NonFungibleToken.CollectionPublic}> = getAccount(owner).capabilities.get<&{NonFungibleToken.CollectionPublic}>(pubPath)
            if !pubCap.check() { panic("custodian collection public cap missing or wrong type") }
            // Cast to preserve ViewResolver interface and store
            var toStore2: @{NonFungibleToken.NFT, ViewResolver.Resolver}? <- nil
            let item: @{NonFungibleToken.NFT, ViewResolver.Resolver} <- nft as! @{NonFungibleToken.NFT, ViewResolver.Resolver}
            if item.id != v.tokenId {
                destroy item
                panic("tokenId mismatch for vault")
            } else {
                toStore2 <-! item
            }
            self.holdings[vaultId] <-! toStore2!
        }

        // Contract-only withdrawal used by protocol flows after redemption
        access(contract) fun gatedWithdraw(vaultId: String): @{NonFungibleToken.NFT} {
            pre { self.holdings[vaultId] != nil: "not held" }
            let r <- self.holdings.remove(key: vaultId)!
            return <- r
        }

        // Read-only access to the NFT's ViewResolver for UI/metadata
        view access(all) fun borrowViewResolver(vaultId: String): &{ViewResolver.Resolver}? {
            return &self.holdings[vaultId] as &{ViewResolver.Resolver}?
        }

        access(all) init() { self.holdings <- {} }

        /// Explicit cleanup: burn any residual NFT for redeemed vaults when total supply is zero
        access(all) fun drain(vaultId: String, declaredTotalSupply: UFix64) {
            pre {
                self.holdings[vaultId] != nil: "not held"
                Fractional.vaults[vaultId] != nil: "unknown vault"
                (Fractional.vaults[vaultId] ?? panic("unknown vault")).state == "redeemed": "vault not redeemed"
                declaredTotalSupply == 0.0: "supply not fully burned"
                self.owner?.address == (Fractional.vaults[vaultId] ?? panic("unknown vault")).custodian: "not custodian"
            }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let nft: @{NonFungibleToken.NFT} <- self.gatedWithdraw(vaultId: vaultId)
            Fractional.emitUnderlyingBurned(vaultId: vaultId, collectionStoragePath: v.collectionStoragePath, collectionPublicPath: v.collectionPublicPath, tokenId: v.tokenId)
            destroy nft
        }

        /// Drain all residual holdings with per-vault declared totals to assert full burn
        access(all) fun drainAll(declaredTotals: {String: UFix64}) {
            var keys: [String] = []
            for k in self.holdings.keys { keys.append(k) }
            var i = 0
            while i < keys.length {
                let vid: String = keys[i]
                let decl: UFix64 = declaredTotals[vid] ?? panic("missing declared total for vault")
                self.drain(vaultId: vid, declaredTotalSupply: decl)
                i = i + 1
            }
        }
    }

    // Helper for simple postconditions
    view access(all) fun sum(_ xs: [UFix64]): UFix64 {
        var s: UFix64 = 0.0
        var i = 0
        while i < xs.length {
            s = s + xs[i]
            i = i + 1
        }
        return s
    }

    access(all) resource Admin {
        access(all) fun createVault(
            vaultId: String,
            collection: String,
            tokenId: UInt64,
            shareSymbol: String,
            policy: String,
            creator: Address
        )
        {

            pre {
                Fractional.vaults[vaultId] == nil: "vault exists"
                Fractional.symbolToVault[shareSymbol] == nil: "symbol taken"
            }

            let v = Vault(
                vaultId: vaultId,
                collection: collection,
                tokenId: tokenId,
                shareSymbol: shareSymbol,
                policy: policy,
                creator: creator,
                collectionStoragePath: "",
                collectionPublicPath: "",
                custodian: creator
            )
            Fractional.vaults[vaultId] = v
            Fractional.symbolToVault[shareSymbol] = vaultId
            // Initialize per‑vault listing fees to defaults
            Fractional.feeBps[vaultId] = Fractional.DEFAULT_LISTING_FEE_BPS
            Fractional.feeSplitVaultBps[vaultId] = Fractional.DEFAULT_LISTING_VAULT_SPLIT_BPS
            Fractional.feeSplitProtocolBps[vaultId] = Fractional.DEFAULT_LISTING_PROTOCOL_SPLIT_BPS
            // Legacy balances are deprecated; do not initialize any internal store
            
            // Set default AMM fees for new vault
            self.setAmmFeeParams(
                vaultId: vaultId,
                ammFeeBps: 50,  // 0.5%
                ammFeeSplitVaultBps: 2000,  // 20% to vault
                ammFeeSplitProtocolBps: 8000  // 80% to platform
            )
            
            emit VaultCreated(vaultId: vaultId, collection: collection, tokenId: tokenId, shareSymbol: shareSymbol, policy: policy, creator: creator)
        }

        // Metadata-only creation; custody movement happens in the transaction prepare
        access(all) fun createVaultFromNFT(
            vaultId: String,
            collectionStoragePath: String,
            collectionPublicPath: String,
            tokenId: UInt64,
            shareSymbol: String,
            policy: String,
            creator: Address
        ) {
            pre {
                Fractional.vaults[vaultId] == nil: "vault exists"
                Fractional.symbolToVault[shareSymbol] == nil: "symbol taken"
            }
            let v = Vault(
                vaultId: vaultId,
                collection: collectionStoragePath,
                tokenId: tokenId,
                shareSymbol: shareSymbol,
                policy: policy,
                creator: creator,
                collectionStoragePath: collectionStoragePath,
                collectionPublicPath: collectionPublicPath,
                custodian: creator
            )
            Fractional.vaults[vaultId] = v
            Fractional.symbolToVault[shareSymbol] = vaultId
            // Initialize per‑vault listing fees to defaults
            Fractional.feeBps[vaultId] = Fractional.DEFAULT_LISTING_FEE_BPS
            Fractional.feeSplitVaultBps[vaultId] = Fractional.DEFAULT_LISTING_VAULT_SPLIT_BPS
            Fractional.feeSplitProtocolBps[vaultId] = Fractional.DEFAULT_LISTING_PROTOCOL_SPLIT_BPS
            // Legacy balances are deprecated; do not initialize any internal store
            
            // Set default AMM fees for new vault
            self.setAmmFeeParams(
                vaultId: vaultId,
                ammFeeBps: 50,  // 0.5%
                ammFeeSplitVaultBps: 2000,  // 20% to vault
                ammFeeSplitProtocolBps: 8000  // 80% to platform
            )
            
            emit VaultCreated(vaultId: vaultId, collection: collectionStoragePath, tokenId: tokenId, shareSymbol: shareSymbol, policy: policy, creator: creator)
        }

        /// Register the concrete FT contract for this vault's shares.
        /// Store address, contract name, and path identifiers for path-driven FT interactions.
        access(all) fun setVaultFT(
            vaultId: String,
            ftAddress: Address,
            ftContractName: String,
            vaultStoragePathIdentifier: String,
            receiverPublicPathIdentifier: String,
            balancePublicPathIdentifier: String
        ) {
            pre { Fractional.vaults[vaultId] != nil: "unknown vault" }
            Fractional.vaultFTAddress[vaultId] = ftAddress
            Fractional.vaultFTContractName[vaultId] = ftContractName
            Fractional.vaultFTVaultStoragePathIdentifier[vaultId] = vaultStoragePathIdentifier
            Fractional.vaultFTReceiverPublicPathIdentifier[vaultId] = receiverPublicPathIdentifier
            Fractional.vaultFTBalancePublicPathIdentifier[vaultId] = balancePublicPathIdentifier
        }

        /// DEPRECATED: This function is no longer functional.
        /// Share minting now happens via the VaultShareToken contract's Admin.mint() function.
        /// Kept for backwards compatibility only.
        access(all) fun mintShares(symbol: String, accounts: [Address], amounts: [UFix64])
        {
            pre {
                accounts.length == amounts.length: "mismatch"
                Fractional.symbolToVault[symbol] != nil: "unknown symbol"
            }
            panic("mintShares is deprecated - use VaultShareToken Admin.mint() instead")
        }

        /// DEPRECATED: This function is no longer functional.
        /// Share transfers now happen via the VaultShareToken FungibleToken standard.
        /// Kept for backwards compatibility only.
        access(all) fun transfer(symbol: String, from: Address, to: Address, amount: UFix64)
        {
            pre {
                amount > 0.0: "amount"
                Fractional.symbolToVault[symbol] != nil: "unknown symbol"
            }
            panic("transfer is deprecated - use VaultShareToken FungibleToken.Vault.withdraw/deposit instead")
        }

        access(all) fun setTransferMode(symbol: String, mode: String)
           
        {
            pre { 
                Fractional.symbolToVault[symbol] != nil: "unknown symbol" 
            }

            let vId: String = Fractional.symbolToVault[symbol] ?? panic("unknown symbol")
            var v: Fractional.Vault = Fractional.vaults[vId] ?? panic("unknown vault")
            let _: String = v.shareSymbol
            v.setMode(mode)
            Fractional.vaults[vId] = v
            emit TransferModeChanged(symbol: symbol, mode: mode)
        }

        access(all) fun redeem(vaultId: String)
           
        {
            pre { 
                Fractional.vaults[vaultId] != nil: "unknown vault" 
            }
             
            var v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            v.setState("redeemed")
            Fractional.vaults[vaultId] = v
            emit Redeemed(vaultId: vaultId)
        }

        access(all) fun setMaxSupply(vaultId: String, maxSupply: UFix64)
        {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
            }
            var v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            // Note: This updates the metadata in Fractional.Vault.
            // The actual maxSupply enforcement happens at the VaultShareToken contract level.
            // If VaultShareToken was already initialized with a different maxSupply,
            // that value cannot be changed (it's immutable in VaultShareToken).
            v.setMaxSupply(maxSupply)
            Fractional.vaults[vaultId] = v
            emit MaxSupplySet(vaultId: vaultId, maxSupply: maxSupply)
        }

        access(all) fun setAllowedPriceAsset(symbol: String, allowed: Bool) {
            Fractional.allowedPriceAssets[symbol] = allowed
        }

        /// Set per-vault fee parameters with caps and split validation.
        access(all) fun setFeeParams(
            vaultId: String,
            feeBps: UInt64,
            vaultSplitBps: UInt64,
            protocolSplitBps: UInt64
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                feeBps <= 10000: "fee bps cap"
                (feeBps == 0 && vaultSplitBps == 0 && protocolSplitBps == 0) || (vaultSplitBps + protocolSplitBps == 10000): "split must sum to 10000 when fee enabled"
            }
            Fractional.feeBps[vaultId] = feeBps
            Fractional.feeSplitVaultBps[vaultId] = vaultSplitBps
            Fractional.feeSplitProtocolBps[vaultId] = protocolSplitBps
            emit FeeParamsSet(vaultId: vaultId, feeBps: feeBps, vaultSplitBps: vaultSplitBps, protocolSplitBps: protocolSplitBps)
        }

        /// Set per-vault AMM fee parameters.
        access(all) fun setAmmFeeParams(
            vaultId: String,
            ammFeeBps: UInt64,
            ammFeeSplitVaultBps: UInt64,
            ammFeeSplitProtocolBps: UInt64
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                ammFeeBps <= 10000: "amm fee bps cap"
                ammFeeBps >= 1: "amm fee bps minimum 0.01%"
                (ammFeeSplitVaultBps + ammFeeSplitProtocolBps == 10000): "split must sum to 10000"
            }
            Fractional.ammFeeBps[vaultId] = ammFeeBps
            Fractional.ammFeeSplitVaultBps[vaultId] = ammFeeSplitVaultBps
            Fractional.ammFeeSplitProtocolBps[vaultId] = ammFeeSplitProtocolBps
            emit FeeParamsSet(vaultId: vaultId, feeBps: ammFeeBps, vaultSplitBps: ammFeeSplitVaultBps, protocolSplitBps: ammFeeSplitProtocolBps)
        }

        /// Schedule fee parameters to take effect at a future height/time provided by caller.
        access(all) fun scheduleFeeParams(
            vaultId: String,
            feeBps: UInt64,
            vaultSplitBps: UInt64,
            protocolSplitBps: UInt64,
            effectiveAt: UInt64
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                feeBps <= 10000: "fee bps cap"
                (feeBps == 0 && vaultSplitBps == 0 && protocolSplitBps == 0) || (vaultSplitBps + protocolSplitBps == 10000): "split must sum to 10000 when fee enabled"
                effectiveAt > 0: "effectiveAt required"
            }
            Fractional.pendingFeeBps[vaultId] = feeBps
            Fractional.pendingFeeSplitVaultBps[vaultId] = vaultSplitBps
            Fractional.pendingFeeSplitProtocolBps[vaultId] = protocolSplitBps
            Fractional.pendingFeeEffectiveAt[vaultId] = effectiveAt
            emit FeeParamsProposed(vaultId: vaultId, feeBps: feeBps, vaultSplitBps: vaultSplitBps, protocolSplitBps: protocolSplitBps, effectiveAt: effectiveAt)
        }

        /// Activate scheduled fee parameters when effectiveAt has elapsed.
        /// Caller passes currentHeight to avoid relying on environment access in contract.
        access(all) fun activateFeeParams(
            vaultId: String,
            currentHeight: UInt64
        ) {
            pre {
                Fractional.pendingFeeEffectiveAt[vaultId] != nil: "no pending"
                currentHeight >= (Fractional.pendingFeeEffectiveAt[vaultId] ?? 0): "not yet effective"
            }
            let newFb: UInt64 = Fractional.pendingFeeBps[vaultId] ?? 0
            let newVs: UInt64 = Fractional.pendingFeeSplitVaultBps[vaultId] ?? 0
            let newPs: UInt64 = Fractional.pendingFeeSplitProtocolBps[vaultId] ?? 0
            Fractional.feeBps[vaultId] = newFb
            Fractional.feeSplitVaultBps[vaultId] = newVs
            Fractional.feeSplitProtocolBps[vaultId] = newPs
            // clear pending entries
            let _ = Fractional.pendingFeeBps.remove(key: vaultId)
            let _2 = Fractional.pendingFeeSplitVaultBps.remove(key: vaultId)
            let _3 = Fractional.pendingFeeSplitProtocolBps.remove(key: vaultId)
            let _4 = Fractional.pendingFeeEffectiveAt.remove(key: vaultId)
            emit FeeParamsActivated(vaultId: vaultId)
            emit FeeParamsSet(vaultId: vaultId, feeBps: newFb, vaultSplitBps: newVs, protocolSplitBps: newPs)
        }

        /// Activate scheduled fee parameters immediately (used by scheduled transactions).
        /// Assumes scheduling honored the delay. No time checks performed here.
        access(all) fun activateFeeParamsNow(
            vaultId: String
        ) {
            pre { Fractional.pendingFeeEffectiveAt[vaultId] != nil: "no pending" }
            let newFb: UInt64 = Fractional.pendingFeeBps[vaultId] ?? 0
            let newVs: UInt64 = Fractional.pendingFeeSplitVaultBps[vaultId] ?? 0
            let newPs: UInt64 = Fractional.pendingFeeSplitProtocolBps[vaultId] ?? 0
            Fractional.feeBps[vaultId] = newFb
            Fractional.feeSplitVaultBps[vaultId] = newVs
            Fractional.feeSplitProtocolBps[vaultId] = newPs
            let _: UInt64? = Fractional.pendingFeeBps.remove(key: vaultId)
            let _2: UInt64? = Fractional.pendingFeeSplitVaultBps.remove(key: vaultId)
            let _3: UInt64? = Fractional.pendingFeeSplitProtocolBps.remove(key: vaultId)
            let _4: UInt64? = Fractional.pendingFeeEffectiveAt.remove(key: vaultId)
            emit FeeParamsActivated(vaultId: vaultId)
            emit FeeParamsSet(vaultId: vaultId, feeBps: newFb, vaultSplitBps: newVs, protocolSplitBps: newPs)
        }

        // Share mode is permanently FT; no setter.

        // Admin-only wrappers for emitting test events
        access(all) fun emitVaultCreated(vaultId: String, collection: String, tokenId: UInt64, shareSymbol: String, policy: String, creator: Address) {
            emit VaultCreated(vaultId: vaultId, collection: collection, tokenId: tokenId, shareSymbol: shareSymbol, policy: policy, creator: creator)
        }

        access(all) fun emitSharesMinted(symbol: String, accounts: [Address], amounts: [UFix64]) {
            pre { accounts.length == amounts.length: "mismatch" }
            var items: [Mint] = []
            var i = 0
            while i < accounts.length {
                items.append(Mint(account: accounts[i], amount: amounts[i]))
                i = i + 1
            }
            emit SharesMinted(symbol: symbol, mints: items)
        }

        access(all) fun emitTransfer(symbol: String, from: Address, to: Address, amount: UFix64) {
            emit Transfer(symbol: symbol, from: from, to: to, amount: amount)
        }

        access(all) fun emitUnderlyingDeposited(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64, nftType: String) {
            emit UnderlyingDeposited(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId, nftType: nftType)
        }
        access(all) fun emitUnderlyingWithdrawn(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64) {
            emit UnderlyingWithdrawn(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId)
        }
        access(all) fun emitUnderlyingBurned(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64) {
            emit UnderlyingBurned(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId)
        }

        // --- Buyout wrappers ---
        access(all) fun proposeBuyout(
            vaultId: String,
            proposalId: String,
            asset: String,
            amount: UFix64,
            quorumPercent: UInt64,
            supportPercent: UInt64,
            expiresAt: UInt64
        ) {
            Fractional.emitBuyoutProposed(
                vaultId: vaultId,
                proposalId: proposalId,
                proposer: self.owner?.address ?? 0x0,
                asset: asset,
                amount: amount,
                quorumPercent: quorumPercent,
                supportPercent: supportPercent,
                expiresAt: expiresAt
            )
        }

        access(all) fun voteBuyout(
            vaultId: String,
            proposalId: String,
            forVotes: UFix64,
            againstVotes: UFix64
        ) {
            Fractional.emitBuyoutVoted(
                vaultId: vaultId,
                proposalId: proposalId,
                forVotes: forVotes,
                againstVotes: againstVotes
            )
        }

        access(all) fun finalizeBuyout(
            vaultId: String,
            proposalId: String,
            result: String
        ) {
            Fractional.emitBuyoutFinalized(
                vaultId: vaultId,
                proposalId: proposalId,
                result: result
            )
            if result == "succeeded" {
                Fractional.emitRedeemed(vaultId: vaultId)
            }
        }

        // --- Distributions wrappers ---
        access(all) fun scheduleDistribution(
            vaultId: String,
            programId: String,
            asset: String,
            totalAmount: UFix64,
            schedule: String,
            startsAt: UInt64,
            endsAt: UInt64
        ) {
            Fractional.emitDistributionScheduled(
                vaultId: vaultId,
                programId: programId,
                asset: asset,
                totalAmount: totalAmount,
                schedule: schedule,
                startsAt: startsAt,
                endsAt: endsAt
            )
        }

        access(all) fun payoutClaimed(
            programId: String,
            account: Address,
            amount: UFix64
        ) {
            Fractional.emitPayoutClaimed(programId: programId, account: account, amount: amount)
        }

        // --- Listings wrappers ---
        /// Create a listing and immediately escrow the seller's shares.
        /// - Debits seller balance and reserves `amount` under (vaultId, listingId).
        /// - Emits ListingCreated with the requested price.
        access(all) fun createListing(
            vaultId: String,
            listingId: String,
            priceAsset: String,
            priceAmount: UFix64,
            amount: UFix64,
            seller: Address
        ) {
            pre {
                amount > 0.0: "amount must be > 0"
                priceAmount > 0.0: "price must be > 0"
                Fractional.allowedPriceAssets[priceAsset] == true: "unsupported price asset"
                Fractional.vaults[vaultId] != nil: "unknown vault"
            }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let _symbol: String = v.shareSymbol
            // FT-only: external tx must have already moved tokens to escrow; record open listing only
            var idx: {String: Bool} = Fractional.openListings[vaultId] ?? {}
            if idx[listingId] == true { panic("listing exists") }
            idx[listingId] = true
            Fractional.openListings[vaultId] = idx
            var ls: {String: Address} = Fractional.listingSeller[vaultId] ?? {}
            ls[listingId] = seller
            Fractional.listingSeller[vaultId] = ls

            Fractional.emitListingCreated(
                vaultId: vaultId,
                listingId: listingId,
                seller: seller,
                priceAsset: priceAsset,
                priceAmount: priceAmount,
                amount: amount
            )
        }

        /// Cancel a listing and refund the reserved shares to the seller.
        access(all) fun cancelListing(
            vaultId: String,
            listingId: String
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                (Fractional.openListings[vaultId] ?? {})[listingId] == true: "listing not open"
            }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let _symbol: String = v.shareSymbol
            var idx: {String: Bool} = Fractional.openListings[vaultId] ?? {}
            if idx[listingId] != true { panic("listing not open") }
            idx[listingId] = false
            Fractional.openListings[vaultId] = idx
            var ls: {String: Address} = Fractional.listingSeller[vaultId] ?? {}
            let _ = ls.remove(key: listingId)
            Fractional.listingSeller[vaultId] = ls

            // FT-only: external tx returns tokens from escrow to seller
            Fractional.emitListingCancelled(vaultId: vaultId, listingId: listingId)
        }

        /// Fill a listing and transfer the reserved shares to the buyer.
        /// The funds leg should already be settled in the transaction (e.g., via Flow Actions)
        /// before calling this function.
        access(all) fun fillListing(
            vaultId: String,
            listingId: String,
            buyer: Address
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                (Fractional.openListings[vaultId] ?? {})[listingId] == true: "listing not open"
            }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let _symbol: String = v.shareSymbol
            var idx: {String: Bool} = Fractional.openListings[vaultId] ?? {}
            if idx[listingId] != true { panic("listing not open") }
            idx[listingId] = false
            Fractional.openListings[vaultId] = idx
            var ls: {String: Address} = Fractional.listingSeller[vaultId] ?? {}
            let _ = ls.remove(key: listingId)
            Fractional.listingSeller[vaultId] = ls

            // FT-only: external tx should have moved tokens from escrow to buyer
            Fractional.emitListingFilled(vaultId: vaultId, listingId: listingId)
        }

        access(all) fun expireListing(
            vaultId: String,
            listingId: String
        ) {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
            }
            // On expire, refund escrow to seller and clear tracking
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let _symbol: String = v.shareSymbol
            var idx: {String: Bool} = Fractional.openListings[vaultId] ?? {}
            if idx[listingId] == true {
                idx[listingId] = false
                Fractional.openListings[vaultId] = idx
                var ls: {String: Address} = Fractional.listingSeller[vaultId] ?? {}
                let _ = ls.remove(key: listingId)
                Fractional.listingSeller[vaultId] = ls
                // FT-only: external tx returns tokens from escrow to seller
            }

            Fractional.emitListingExpired(vaultId: vaultId, listingId: listingId)
        }

        /// Record a fee accrual for transparency after routing in the transaction.
        access(all) fun recordFeeAccrued(
            vaultId: String,
            kind: String,
            token: String,
            amount: UFix64,
            vaultShare: UFix64,
            protocolShare: UFix64,
            payer: Address
        ) {
            pre { Fractional.vaults[vaultId] != nil: "unknown vault" }
            Fractional.emitFeeAccrued(
                vaultId: vaultId,
                kind: kind,
                token: token,
                amount: amount,
                vaultShare: vaultShare,
                protocolShare: protocolShare,
                payer: payer
            )
        }

        /// Withdraw the underlying from a user LockBox after redemption has been set.
        /// NOTE: This function does not itself burn shares; the transaction must ensure
        /// all supply is burned before calling and that state is set to "redeemed".
        access(all) fun withdrawFromLockBox(lockbox: &Fractional.LockBox, vaultId: String, declaredTotalSupply: UFix64): @{NonFungibleToken.NFT} {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                (Fractional.vaults[vaultId] ?? panic("unknown vault")).state == "redeemed": "vault not redeemed"
                declaredTotalSupply == 0.0: "supply not fully burned"
            }
            let v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            let nft: @{NonFungibleToken.NFT} <- lockbox.gatedWithdraw(vaultId: vaultId)
            Fractional.emitUnderlyingWithdrawn(vaultId: vaultId, collectionStoragePath: v.collectionStoragePath, collectionPublicPath: v.collectionPublicPath, tokenId: v.tokenId)
            return <- nft
        }

        /// Convenience: set state to redeemed then withdraw from LockBox in one call.
        /// Caller must ensure shares are fully burned prior to calling.
        access(all) fun redeemAndWithdraw(lockbox: &Fractional.LockBox, vaultId: String, declaredTotalSupply: UFix64): @{NonFungibleToken.NFT} {
            pre {
                Fractional.vaults[vaultId] != nil: "unknown vault"
                declaredTotalSupply == 0.0: "supply not fully burned"
            }
            var v: Fractional.Vault = Fractional.vaults[vaultId] ?? panic("unknown vault")
            v.setState("redeemed")
            Fractional.vaults[vaultId] = v
            emit Redeemed(vaultId: vaultId)
            let nft: @{NonFungibleToken.NFT} <- lockbox.gatedWithdraw(vaultId: vaultId)
            Fractional.emitUnderlyingWithdrawn(vaultId: vaultId, collectionStoragePath: v.collectionStoragePath, collectionPublicPath: v.collectionPublicPath, tokenId: v.tokenId)
            return <- nft
        }
    }

    access(all) fun createAdmin(): @Admin {
        pre { !self.adminIssued: "admin already issued" }
        self.adminIssued = true
        return <- create Admin()
    }

    access(all) fun createCustody(): @Custody { return <- create Custody() }

    access(all) fun createLockBox(): @LockBox { return <- create LockBox() }

    // Simple read helpers
    view access(all) fun getVault(vaultId: String): Vault? { return self.vaults[vaultId] }
    view access(all) fun getVaultIdBySymbol(symbol: String): String? { return self.symbolToVault[symbol] }

    /// Read per-vault listing fee parameters. Always returns a value (defaults when unset).
    view access(all) fun getFeeParams(vaultId: String): {String: UInt64} {
        let fb: UInt64 = self.feeBps[vaultId] ?? Fractional.DEFAULT_LISTING_FEE_BPS
        let vs: UInt64 = self.feeSplitVaultBps[vaultId] ?? Fractional.DEFAULT_LISTING_VAULT_SPLIT_BPS
        let ps: UInt64 = self.feeSplitProtocolBps[vaultId] ?? Fractional.DEFAULT_LISTING_PROTOCOL_SPLIT_BPS
        return {
            "feeBps": fb,
            "vaultSplitBps": vs,
            "protocolSplitBps": ps
        }
    }

    /// Read per-vault AMM fee parameters. Returns defaults if not set.
    view access(all) fun getAmmFeeParams(vaultId: String): {String: UInt64} {
        let fb: UInt64 = self.ammFeeBps[vaultId] ?? 50  // Default 0.5%
        let vs: UInt64 = self.ammFeeSplitVaultBps[vaultId] ?? 2000  // Default 20%
        let ps: UInt64 = self.ammFeeSplitProtocolBps[vaultId] ?? 8000  // Default 80%
        return {
            "ammFeeBps": fb,
            "ammFeeSplitVaultBps": vs,
            "ammFeeSplitProtocolBps": ps
        }
    }

    /// Read pending per-vault fee parameters with effectiveAt. Returns nil if none.
    view access(all) fun getPendingFeeParams(vaultId: String): {String: UInt64}? {
        if self.pendingFeeEffectiveAt[vaultId] == nil { return nil }
        let fb: UInt64 = self.pendingFeeBps[vaultId] ?? 0
        let vs: UInt64 = self.pendingFeeSplitVaultBps[vaultId] ?? 0
        let ps: UInt64 = self.pendingFeeSplitProtocolBps[vaultId] ?? 0
        let ea: UInt64 = self.pendingFeeEffectiveAt[vaultId] ?? 0
        return {
            "feeBps": fb,
            "vaultSplitBps": vs,
            "protocolSplitBps": ps,
            "effectiveAt": ea
        }
    }

    /// Public liveness check for custody (LockBox) of a given vaultId and custodian address.
    view access(all) fun isCustodyAlive(vaultId: String, custodian: Address): Bool {
        let cap: Capability<&{LockBoxPublic}> = getAccount(custodian).capabilities.get<&{LockBoxPublic}>(Fractional.LockBoxPublicPath)
        if !cap.check() { return false }
        if let lb: &{LockBoxPublic} = cap.borrow() { return lb.borrowViewResolver(vaultId: vaultId) != nil }
        return false
    }

    // --- Minimal Buyout Escrow (opt-in tender) ---
    access(all) event BuyoutEscrowCreated(vaultId: String, buyer: Address, priceAsset: String, pricePerShare: UFix64)
    access(all) event BuyoutEscrowCancelled(vaultId: String, buyer: Address)
    access(all) event BuyoutEscrowClosed(vaultId: String, buyer: Address)

    access(all) resource BuyoutEscrow {
        access(all) let buyer: Address
        access(all) let vaultId: String
        access(all) let priceAsset: String
        access(all) let pricePerShare: UFix64
        access(all) var open: Bool

        /// Withdraw escrowed funds back to buyer (owner) on cancel
        access(all) fun cancel() {
            pre { self.open: "escrow closed" }
            self.open = false
            emit BuyoutEscrowCancelled(vaultId: self.vaultId, buyer: self.buyer)
        }

        /// Close escrow after external finalize (burn + redeem handled in tx)
        access(all) fun close() {
            pre { self.open: "escrow already closed" }
            self.open = false
            emit BuyoutEscrowClosed(vaultId: self.vaultId, buyer: self.buyer)
        }

        access(all) init(buyer: Address, vaultId: String, priceAsset: String, pricePerShare: UFix64) {
            self.buyer = buyer
            self.vaultId = vaultId
            self.priceAsset = priceAsset
            self.pricePerShare = pricePerShare
            self.open = true
        }
    }

    access(all) fun createBuyoutEscrow(buyer: Address, vaultId: String, priceAsset: String, pricePerShare: UFix64): @BuyoutEscrow {
        emit BuyoutEscrowCreated(vaultId: vaultId, buyer: buyer, priceAsset: priceAsset, pricePerShare: pricePerShare)
        return <- create BuyoutEscrow(buyer: buyer, vaultId: vaultId, priceAsset: priceAsset, pricePerShare: pricePerShare)
    }

    // Capability-based fee activation for scheduler parity
    access(all) resource interface FeeActivation {
        access(all) fun activate(vaultId: String)
    }

    access(all) resource FeeActivator: FeeActivation {
        access(all) fun activate(vaultId: String) {
            pre { Fractional.pendingFeeEffectiveAt[vaultId] != nil: "no pending" }
            let newFb: UInt64 = Fractional.pendingFeeBps[vaultId] ?? 0
            let newVs: UInt64 = Fractional.pendingFeeSplitVaultBps[vaultId] ?? 0
            let newPs: UInt64 = Fractional.pendingFeeSplitProtocolBps[vaultId] ?? 0
            Fractional.feeBps[vaultId] = newFb
            Fractional.feeSplitVaultBps[vaultId] = newVs
            Fractional.feeSplitProtocolBps[vaultId] = newPs
            let _: UInt64? = Fractional.pendingFeeBps.remove(key: vaultId)
            let _2: UInt64? = Fractional.pendingFeeSplitVaultBps.remove(key: vaultId)
            let _3: UInt64? = Fractional.pendingFeeSplitProtocolBps.remove(key: vaultId)
            let _4: UInt64? = Fractional.pendingFeeEffectiveAt.remove(key: vaultId)
            emit FeeParamsActivated(vaultId: vaultId)
            emit FeeParamsSet(vaultId: vaultId, feeBps: newFb, vaultSplitBps: newVs, protocolSplitBps: newPs)
        }
    }

    access(all) fun createFeeActivator(): @FeeActivator { return <- create FeeActivator() }

    // Public immediate activation has been removed. Use FeeActivator capability via scheduler.

    // Emitters for testing are now restricted to contract-only. Use Admin wrappers above.
    access(contract) fun createVault(vaultId: String, collection: String, tokenId: UInt64, shareSymbol: String, policy: String, creator: Address) {
        emit VaultCreated(vaultId: vaultId, collection: collection, tokenId: tokenId, shareSymbol: shareSymbol, policy: policy, creator: creator)
    }

    access(contract) fun emitSharesMinted(symbol: String, accounts: [Address], amounts: [UFix64]) {
        pre { accounts.length == amounts.length: "mismatch" }
        var items: [Mint] = []
        var i = 0
        while i < accounts.length {
            items.append(Mint(account: accounts[i], amount: amounts[i]))
            i = i + 1
        }
        emit SharesMinted(symbol: symbol, mints: items)
    }

    access(contract) fun emitTransfer(symbol: String, from: Address, to: Address, amount: UFix64) { emit Transfer(symbol: symbol, from: from, to: to, amount: amount) }
    access(contract) fun emitTransferModeChanged(symbol: String, mode: String) { emit TransferModeChanged(symbol: symbol, mode: mode) }
    access(contract) fun emitRedeemed(vaultId: String) { emit Redeemed(vaultId: vaultId) }
    access(contract) fun emitMaxSupplySet(vaultId: String, maxSupply: UFix64) { emit MaxSupplySet(vaultId: vaultId, maxSupply: maxSupply) }

    access(contract) fun emitBuyoutProposed(vaultId: String, proposalId: String, proposer: Address, asset: String, amount: UFix64, quorumPercent: UInt64, supportPercent: UInt64, expiresAt: UInt64) {
        emit BuyoutProposed(vaultId: vaultId, proposalId: proposalId, proposer: proposer, asset: asset, amount: amount, quorumPercent: quorumPercent, supportPercent: supportPercent, expiresAt: expiresAt)
    }
    access(contract) fun emitBuyoutVoted(vaultId: String, proposalId: String, forVotes: UFix64, againstVotes: UFix64) { emit BuyoutVoted(vaultId: vaultId, proposalId: proposalId, forVotes: forVotes, againstVotes: againstVotes) }
    access(contract) fun emitBuyoutFinalized(vaultId: String, proposalId: String, result: String) { emit BuyoutFinalized(vaultId: vaultId, proposalId: proposalId, result: result) }

    access(contract) fun emitDistributionScheduled(vaultId: String, programId: String, asset: String, totalAmount: UFix64, schedule: String, startsAt: UInt64, endsAt: UInt64) {
        emit DistributionScheduled(vaultId: vaultId, programId: programId, asset: asset, totalAmount: totalAmount, schedule: schedule, startsAt: startsAt, endsAt: endsAt)
    }
    access(contract) fun emitPayoutClaimed(programId: String, account: Address, amount: UFix64) { emit PayoutClaimed(programId: programId, account: account, amount: amount) }

    access(contract) fun emitListingCreated(vaultId: String, listingId: String, seller: Address, priceAsset: String, priceAmount: UFix64, amount: UFix64) {
        emit ListingCreated(vaultId: vaultId, listingId: listingId, seller: seller, priceAsset: priceAsset, priceAmount: priceAmount, amount: amount)
    }
    access(contract) fun emitListingFilled(vaultId: String, listingId: String) { emit ListingFilled(vaultId: vaultId, listingId: listingId) }
    access(contract) fun emitListingCancelled(vaultId: String, listingId: String) { emit ListingCancelled(vaultId: vaultId, listingId: listingId) }
    access(contract) fun emitListingExpired(vaultId: String, listingId: String) { emit ListingExpired(vaultId: vaultId, listingId: listingId) }

    access(contract) fun emitFeeAccrued(
        vaultId: String,
        kind: String,
        token: String,
        amount: UFix64,
        vaultShare: UFix64,
        protocolShare: UFix64,
        payer: Address
    ) {
        emit FeeAccrued(
            vaultId: vaultId,
            kind: kind,
            token: token,
            amount: amount,
            vaultShare: vaultShare,
            protocolShare: protocolShare,
            payer: payer
        )
    }

    access(contract) fun emitPoolCreated(vaultId: String, poolId: String, assetA: String, assetB: String, reserveA: UFix64, reserveB: UFix64, feeBps: UInt64) {
        emit PoolCreated(vaultId: vaultId, poolId: poolId, assetA: assetA, assetB: assetB, reserveA: reserveA, reserveB: reserveB, feeBps: feeBps)
    }
    access(contract) fun emitLiquidityAdded(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64) { emit LiquidityAdded(vaultId: vaultId, poolId: poolId, reserveA: reserveA, reserveB: reserveB) }
    access(contract) fun emitLiquidityRemoved(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64) { emit LiquidityRemoved(vaultId: vaultId, poolId: poolId, reserveA: reserveA, reserveB: reserveB) }
    access(contract) fun emitSwap(vaultId: String, poolId: String, reserveA: UFix64, reserveB: UFix64) { emit Swap(vaultId: vaultId, poolId: poolId, reserveA: reserveA, reserveB: reserveB) }

    access(contract) fun emitUnderlyingDeposited(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64, nftType: String) {
        emit UnderlyingDeposited(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId, nftType: nftType)
    }
    access(contract) fun emitUnderlyingWithdrawn(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64) {
        emit UnderlyingWithdrawn(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId)
    }
    access(contract) fun emitUnderlyingBurned(vaultId: String, collectionStoragePath: String, collectionPublicPath: String, tokenId: UInt64) {
        emit UnderlyingBurned(vaultId: vaultId, collectionStoragePath: collectionStoragePath, collectionPublicPath: collectionPublicPath, tokenId: tokenId)
    }

    access(all) view fun getVaultFT(vaultId: String): {String: String}? {
        if self.vaultFTContractName[vaultId] == nil { return nil }
        let addr: Address = self.vaultFTAddress[vaultId]!
        let name: String = self.vaultFTContractName[vaultId]!
        let storage: String = self.vaultFTVaultStoragePathIdentifier[vaultId]!
        let receiver: String = self.vaultFTReceiverPublicPathIdentifier[vaultId]!
        let balance: String = self.vaultFTBalancePublicPathIdentifier[vaultId]!
        return {
            "address": addr.toString(),
            "name": name,
            "storage": storage,
            "receiver": receiver,
            "balance": balance
        }
    }

    init() {
        self.vaults = {}
        self.symbolToVault = {}
        self.vaultFTAddress = {}
        self.vaultFTContractName = {}
        self.vaultFTVaultStoragePathIdentifier = {}
        self.vaultFTReceiverPublicPathIdentifier = {}
        self.vaultFTBalancePublicPathIdentifier = {}
        self.adminIssued = false
        self.openListings = {}
        self.listingSeller = {}
        self.allowedPriceAssets = {}
        self.feeBps = {}
        self.feeSplitVaultBps = {}
        self.feeSplitProtocolBps = {}
        self.pendingFeeBps = {}
        self.pendingFeeSplitVaultBps = {}
        self.pendingFeeSplitProtocolBps = {}
        self.pendingFeeEffectiveAt = {}
        self.ammFeeBps = {}
        self.ammFeeSplitVaultBps = {}
        self.ammFeeSplitProtocolBps = {}
        // Paths for FeeActivator capability
        self.FeeActivatorStoragePath = /storage/FractionalFeeActivator
        self.FeeActivatorPublicPath = /public/FractionalFeeActivator
        // Defaults (can be updated via Admin function below)
        self.allowedPriceAssets["FLOW"] = true
        self.allowedPriceAssets["USDCFlow"] = true
        // Public path for custody metadata access
        self.CustodyPublicPath = /public/FractionalCustody
        // Public path for LockBox capability
        self.LockBoxPublicPath = /public/FractionalLockBox
     
        self.DEFAULT_LISTING_FEE_BPS = 50
        self.DEFAULT_LISTING_VAULT_SPLIT_BPS = 2000
        self.DEFAULT_LISTING_PROTOCOL_SPLIT_BPS = 8000
    }

}


