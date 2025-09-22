import "FungibleToken"
import "FlowToken"
import "DeFiActionsUtils"
import "Fractional"

// ConstantProductAMM: permissionless pools for Share (VaultShareToken) against FLOW
// Simple x*y=k AMM with fee on input accruing to reserves (benefits LPs)
// One pool per (share symbol, feeBps). Pool is stored in the creator's account; a
// public capability is published at /public/AMM_Pool_<poolId> for discovery.
access(all) contract ConstantProductAMM {

  access(all) event PoolCreated(
    vaultId: String,
    poolId: String,
    assetA: String, // share symbol
    assetB: String, // "FLOW"
    reserveA: UFix64,
    reserveB: UFix64,
    feeBps: UInt64
  )

  access(all) event LiquidityAdded(
    vaultId: String,
    poolId: String,
    provider: Address,
    amountShare: UFix64,
    amountFlow: UFix64,
    lpMinted: UFix64,
    reserveA: UFix64,
    reserveB: UFix64
  )

  access(all) event LiquidityRemoved(
    vaultId: String,
    poolId: String,
    provider: Address,
    amountShare: UFix64,
    amountFlow: UFix64,
    lpBurned: UFix64,
    reserveA: UFix64,
    reserveB: UFix64
  )

  access(all) event Swap(
    vaultId: String,
    poolId: String,
    trader: Address,
    inToken: String, // "SHARE" or "FLOW"
    inAmount: UFix64,
    outToken: String, // "FLOW" or "SHARE"
    outAmount: UFix64,
    feePaid: UFix64,
    reserveA: UFix64,
    reserveB: UFix64,
    inSymbol: String,
    outSymbol: String,
    inTypeId: String,
    outTypeId: String
  )

  access(all) view fun derivePoolId(symbol: String, feeBps: UInt64): String {
    pre { !symbol.contains("|"): "symbol cannot contain '|'" }
    return symbol.concat("_").concat(feeBps.toString())
  }

  // Minimal LP vault for accounting; scoped to a pool and not globally transferable
  access(all) resource LPVault {
    access(contract) var balance: UFix64
    init(initBalance: UFix64) { self.balance = initBalance }
    access(all) fun withdraw(amount: UFix64): @LPVault {
      pre { amount > 0.0: "withdraw amount must be positive"; self.balance >= amount: "insufficient LP" }
      self.balance = self.balance - amount
      return <-create LPVault(initBalance: amount)
    }
    access(all) fun deposit(from: @LPVault) { let v <- from; self.balance = self.balance + v.balance; destroy v }
    access(all) view fun getBalance(): UFix64 { return self.balance }
  }

  

  access(all) resource Pool {
    access(all) let vaultId: String
    access(all) let symbol: String
    access(all) let poolId: String
    access(all) let feeBps: UInt64

    access(all) let shareVaultType: Type
    access(self) var shareReserve: @{FungibleToken.Vault}
    access(self) var flowReserve: @FlowToken.Vault
    access(self) var totalLP: UFix64

    init(vaultId: String, symbol: String, feeBps: UInt64, shareVaultType: Type) {
      pre { feeBps <= 1000: "feeBps too high" }
      self.vaultId = vaultId
      self.symbol = symbol
      self.poolId = ConstantProductAMM.derivePoolId(symbol: symbol, feeBps: feeBps)
      self.feeBps = feeBps
      self.shareVaultType = shareVaultType
      self.shareReserve <- DeFiActionsUtils.getEmptyVault(shareVaultType)
      self.flowReserve <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      self.totalLP = 0.0
    }

    access(all) view fun reserves(): {String: UFix64} { return { "share": self.shareReserve.balance, "flow": self.flowReserve.balance } }
    access(all) view fun getShareVaultType(): Type { return self.shareVaultType }
    access(all) view fun getTotalLP(): UFix64 { return self.totalLP }

    access(self) view fun _feeMul(): UFix64 { return (10000.0 - UFix64(self.feeBps)) / 10000.0 }

    access(all) view fun quoteOutShareToFlow(amountIn: UFix64): UFix64 {
      if amountIn <= 0.0 { return 0.0 }
      let inAfterFee = amountIn * self._feeMul()
      let x = self.shareReserve.balance
      let y = self.flowReserve.balance
      return (y * inAfterFee) / (x + inAfterFee)
    }

    access(all) view fun quoteOutFlowToShare(amountIn: UFix64): UFix64 {
      if amountIn <= 0.0 { return 0.0 }
      let inAfterFee = amountIn * self._feeMul()
      let x = self.flowReserve.balance
      let y = self.shareReserve.balance
      return (y * inAfterFee) / (x + inAfterFee)
    }

    access(all) fun addLiquidity(share: @{FungibleToken.Vault}, flow: @FlowToken.Vault, minLpOut: UFix64, provider: Address): @LPVault {
      pre { share.balance > 0.0: "zero share"; flow.balance > 0.0: "zero flow"; share.getType() == self.shareVaultType: "unsupported share FT" }
      let x0 = self.shareReserve.balance
      let y0 = self.flowReserve.balance
      let shareIn: UFix64 = share.balance
      let flowIn: UFix64 = flow.balance
      var lpMint: UFix64 = 0.0
      if x0 == 0.0 && y0 == 0.0 {
        lpMint = self._sqrtUFix64(shareIn * flowIn)
      } else {
        // Allow reasonable tolerance for floating point precision (1e-3 = 0.1%)
        let left: UFix64 = shareIn * y0
        let right: UFix64 = flowIn * x0
        let diff: UFix64 = left > right ? left - right : right - left
        let tolerance: UFix64 = 0.001
        if diff > tolerance { panic("imbalanced add; deposit proportional amounts") }
        lpMint = (shareIn / x0) * self.totalLP
      }
      if lpMint < minLpOut { panic("slippage: lpOut < min") }
      self.shareReserve.deposit(from: <-share)
      self.flowReserve.deposit(from: <-flow)
      self.totalLP = self.totalLP + lpMint
      emit LiquidityAdded(
        vaultId: self.vaultId,
        poolId: self.poolId,
        provider: provider,
        amountShare: shareIn,
        amountFlow: flowIn,
        lpMinted: lpMint,
        reserveA: self.shareReserve.balance,
        reserveB: self.flowReserve.balance
      )
      return <-create LPVault(initBalance: lpMint)
    }

    /// Add liquidity with automatic change refund. Accepts any amounts for share and FLOW.
    /// Deposits only the exact proportional amounts according to current reserves and
    /// refunds any leftovers to the provided receiver capabilities. Returns minted LP
    /// (may be 0.0 if inputs are too small after rounding to 8dp multiples).
    access(all) fun addLiquidityWithChange(
      share: @{FungibleToken.Vault},
      flow: @FlowToken.Vault,
      minLpOut: UFix64,
      provider: Address,
      shareRefund: Capability<&{FungibleToken.Receiver}>,
      flowRefund: Capability<&{FungibleToken.Receiver}>
    ): @LPVault {
      pre { share.getType() == self.shareVaultType: "unsupported share FT" }
      let x0: UFix64 = self.shareReserve.balance
      let y0: UFix64 = self.flowReserve.balance

      // Bootstrap path: pool empty behaves as standard addLiquidity (no change)
      if x0 == 0.0 && y0 == 0.0 {
        return <-self.addLiquidity(share: <-share, flow: <-flow, minLpOut: minLpOut, provider: provider)
      }

      // Calculate the limiting ratio (smaller contribution percentage)
      let shareRatio: UFix64 = share.balance / x0
      let flowRatio: UFix64 = flow.balance / y0
      let useRatio: UFix64 = shareRatio < flowRatio ? shareRatio : flowRatio
      
      if useRatio > 0.0 {
        // Calculate proportional amounts based on limiting ratio
        let useShare: UFix64 = useRatio * x0
        let useFlow: UFix64 = useRatio * y0

        // Split provided inputs into used and change
        let shareRef: auth(FungibleToken.Withdraw) &{FungibleToken.Vault} = &share
        let useShareVault: @{FungibleToken.Vault} <- shareRef.withdraw(amount: useShare)
        let flowRef: auth(FungibleToken.Withdraw) &FlowToken.Vault = &flow
        let useFlowVault: @FlowToken.Vault <- flowRef.withdraw(amount: useFlow) as! @FlowToken.Vault

        // Refund leftovers
        let sr3: &{FungibleToken.Receiver} = shareRefund.borrow() ?? panic("share refund receiver invalid")
        if share.balance > 0.0 { sr3.deposit(from: <-share) } else { destroy share }
        let fr3: &{FungibleToken.Receiver} = flowRefund.borrow() ?? panic("flow refund receiver invalid")
        if flow.balance > 0.0 { fr3.deposit(from: <-flow) } else { destroy flow }

        // Call standard addLiquidity with exact proportional pair
        return <-self.addLiquidity(share: <-useShareVault, flow: <-useFlowVault, minLpOut: minLpOut, provider: provider)
      } else {
        // No valid contribution; refund all and return zero LP
        let sr: &{FungibleToken.Receiver} = shareRefund.borrow() ?? panic("share refund receiver invalid")
        sr.deposit(from: <-share)
        let fr: &{FungibleToken.Receiver} = flowRefund.borrow() ?? panic("flow refund receiver invalid")
        fr.deposit(from: <-flow)
        return <-create LPVault(initBalance: 0.0)
      }
    }

    access(self) view fun _sqrtUFix64(_ x: UFix64): UFix64 {
      if x == 0.0 { return 0.0 }
      var r: UFix64 = 1.0
      var i: UInt64 = 0
      while i < 6 {
        r = (r + (x / r)) / 2.0
        i = i + 1
      }
      return r
    }

    // Note: addLiquidityOptimal with change return omitted in v1 to avoid nested resource patterns.

    access(all) fun removeLiquidity(lp: @LPVault, minShare: UFix64, minFlow: UFix64, provider: Address): @{String: {FungibleToken.Vault}} {
      pre { lp.getBalance() > 0.0: "zero lp"; self.totalLP > 0.0: "no lp supply" }
      let portion: UFix64 = lp.getBalance() / self.totalLP
      let outShare: UFix64 = portion * self.shareReserve.balance
      let outFlow: UFix64 = portion * self.flowReserve.balance
      if outShare < minShare { panic("slippage: share below min") }
      if outFlow < minFlow { panic("slippage: flow below min") }

      let shareWithdrawRef = &self.shareReserve as auth(FungibleToken.Withdraw) &{FungibleToken.Vault}
      let withdrawnShare <- shareWithdrawRef.withdraw(amount: outShare)
      let flowWithdrawRef = &self.flowReserve as auth(FungibleToken.Withdraw) &FlowToken.Vault
      let withdrawnFlow <- flowWithdrawRef.withdraw(amount: outFlow)
      self.totalLP = self.totalLP - lp.getBalance()
      let lpBurned: UFix64 = lp.getBalance()
      destroy lp
      emit LiquidityRemoved(
        vaultId: self.vaultId,
        poolId: self.poolId,
        provider: provider,
        amountShare: outShare,
        amountFlow: outFlow,
        lpBurned: lpBurned,
        reserveA: self.shareReserve.balance,
        reserveB: self.flowReserve.balance
      )
      // Return both assets to the provider as a dictionary of FT vaults
      let out: @{String: {FungibleToken.Vault}} <- {
        "share": <-withdrawnShare,
        "flow": <-withdrawnFlow
      }
      return <-out
    }

    access(all) fun swapShareForFlow(input: @{FungibleToken.Vault}, minOut: UFix64, trader: Address): @{String: {FungibleToken.Vault}} {
      pre { input.balance > 0.0: "zero in"; input.getType() == self.shareVaultType: "unsupported share FT" }
      
      let amountIn: UFix64 = input.balance
      
      // Get vault's AMM fee parameters
      let feeParams: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: self.vaultId)
      let ammFeeBps: UInt64 = feeParams["ammFeeBps"]!
      let platformFee: UFix64 = (amountIn * UFix64(ammFeeBps)) / 10000.0
      
      // Extract platform fee before reserves update
      let inputRef: auth(FungibleToken.Withdraw) &{FungibleToken.Vault} = &input
      let feeVault: @{FungibleToken.Vault} <- inputRef.withdraw(amount: platformFee)

      // Compute output against current reserves (pre‑deposit)
      let effectiveIn: UFix64 = amountIn - platformFee
      let outAmt: UFix64 = self.quoteOutShareToFlow(amountIn: effectiveIn)
      if outAmt < minOut { panic("slippage: out < min") }

      // Withdraw output first, then add input to reserves
      let flowWithdrawRef2 = &self.flowReserve as auth(FungibleToken.Withdraw) &FlowToken.Vault
      let out: @FlowToken.Vault <- flowWithdrawRef2.withdraw(amount: outAmt) as! @FlowToken.Vault
      self.shareReserve.deposit(from: <-input)
      
      let feePaid: UFix64 = amountIn - (amountIn * self._feeMul())
      emit Swap(
        vaultId: self.vaultId,
        poolId: self.poolId,
        trader: trader,
        inToken: "SHARE",
        inAmount: amountIn,
        outToken: "FLOW",
        outAmount: outAmt,
        feePaid: feePaid + platformFee,  // Include platform fee in total
        reserveA: self.shareReserve.balance,
        reserveB: self.flowReserve.balance,
        inSymbol: self.symbol,
        outSymbol: "FLOW",
        inTypeId: self.shareVaultType.identifier,
        outTypeId: Type<@FlowToken.Vault>().identifier
      )
      
      return <- {
        "output": <-out,
        "fee": <-feeVault
      }
    }

    access(all) fun swapFlowForShare(input: @FlowToken.Vault, minOut: UFix64, trader: Address): @{String: {FungibleToken.Vault}} {
      pre { input.balance > 0.0: "zero in" }
      
      let amountIn: UFix64 = input.balance
      
      // Get vault's AMM fee parameters
      let feeParams: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: self.vaultId)
      let ammFeeBps: UInt64 = feeParams["ammFeeBps"]!
      let platformFee: UFix64 = (amountIn * UFix64(ammFeeBps)) / 10000.0
      
      // Extract platform fee before reserves update
      let inputRef: auth(FungibleToken.Withdraw) &FlowToken.Vault = &input as auth(FungibleToken.Withdraw) &FlowToken.Vault
      let feeVault: @FlowToken.Vault <- inputRef.withdraw(amount: platformFee) as! @FlowToken.Vault

      // Compute output against current reserves (pre‑deposit)
      let effectiveIn: UFix64 = amountIn - platformFee
      let outAmt: UFix64 = self.quoteOutFlowToShare(amountIn: effectiveIn)
      if outAmt < minOut { panic("slippage: out < min") }

      // Withdraw output first, then add input to reserves
      let shareWithdrawRef2 = &self.shareReserve as auth(FungibleToken.Withdraw) &{FungibleToken.Vault}
      let out <- shareWithdrawRef2.withdraw(amount: outAmt)
      self.flowReserve.deposit(from: <-input)
      
      let feePaid: UFix64 = amountIn - (amountIn * self._feeMul())
      emit Swap(
        vaultId: self.vaultId,
        poolId: self.poolId,
        trader: trader,
        inToken: "FLOW",
        inAmount: amountIn,
        outToken: "SHARE",
        outAmount: outAmt,
        feePaid: feePaid + platformFee,
        reserveA: self.shareReserve.balance,
        reserveB: self.flowReserve.balance,
        inSymbol: "FLOW",
        outSymbol: self.symbol,
        inTypeId: Type<@FlowToken.Vault>().identifier,
        outTypeId: self.shareVaultType.identifier
      )
      
      return <- {
        "output": <-out,
        "fee": <-feeVault
      }
    }
  }

  access(all) resource Factory {
    access(all) fun createPool(account: auth(SaveValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability, BorrowValue) &Account, vaultId: String, symbol: String, feeBps: UInt64, shareVaultType: Type): &Pool {
      pre {
        // Only allow vault share FTs: must be a FungibleToken-defined vault
        DeFiActionsUtils.definingContractIsFungibleToken(shareVaultType): "shareVaultType must be a FungibleToken"
      }
      let p: @ConstantProductAMM.Pool <- create Pool(vaultId: vaultId, symbol: symbol, feeBps: feeBps, shareVaultType: shareVaultType)
      let poolId: String = p.poolId
      let storagePath: StoragePath = StoragePath(identifier: ConstantProductAMM._poolStorageIdentifier(poolId: poolId))!
      account.storage.save(<-p, to: storagePath)
      let cap: Capability<&ConstantProductAMM.Pool> = account.capabilities.storage.issue<&Pool>(storagePath)
      let publicPath: PublicPath = PublicPath(identifier: ConstantProductAMM._poolPublicIdentifier(poolId: poolId))!
      let _ = account.capabilities.unpublish(publicPath)
      account.capabilities.publish(cap, at: publicPath)
      emit PoolCreated(
        vaultId: vaultId,
        poolId: poolId,
        assetA: symbol,
        assetB: "FLOW",
        reserveA: 0.0,
        reserveB: 0.0,
        feeBps: feeBps
      )
      return account.storage.borrow<&Pool>(from: storagePath)!
    }
  }

  // Helpers for deriving storage/public path identifiers for pool capabilities
  access(all) view fun getPoolPublicPath(poolId: String): PublicPath {
    return PublicPath(identifier: ConstantProductAMM._poolPublicIdentifier(poolId: poolId))!
  }

  access(all) view fun getPoolStoragePath(poolId: String): StoragePath {
    return StoragePath(identifier: ConstantProductAMM._poolStorageIdentifier(poolId: poolId))!
  }

  access(self) view fun _poolPublicIdentifier(poolId: String): String { return "AMM_Pool_".concat(poolId) }
  access(self) view fun _poolStorageIdentifier(poolId: String): String { return "AMM_Pool_".concat(poolId) }

  access(all) fun borrowFactory(): &Factory? {
    return self.account.storage.borrow<&Factory>(from: /storage/AMMFactoryV1)
  }

  init() {
    let f: @Factory <- create Factory()
    self.account.storage.save(<-f, to: /storage/AMMFactoryV1)
  }
}



