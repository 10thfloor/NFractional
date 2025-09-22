import "FungibleToken"
import "FungibleTokenMetadataViews"
import "MetadataViews"

/// VaultShareToken
/// Reusable FT implementation intended for per-vault share tokens.
/// Configure name, symbol, decimals, and optional maxSupply at deployment.
/// Paths are derived from the symbol to avoid collisions across multiple series.
///
/// NOTE: This is a standalone FT. Each vault should deploy its own instance
/// or a factory should deploy/initialize an instance per vault.
access(all) contract VaultShareToken: FungibleToken {

  /// Token metadata
  access(all) let name: String
  access(all) let symbol: String
  access(all) let decimals: UInt8

  /// Optional maximum supply (nil => unbounded)
  access(all) let maxSupply: UFix64?

  /// Total supply tracking
  access(all) var totalSupply: UFix64

  /// Storage/public path identifiers are derived from the symbol to avoid collisions
  access(all) let vaultStoragePathIdentifier: String
  access(all) let receiverPublicPathIdentifier: String
  access(all) let balancePublicPathIdentifier: String
  access(all) let adminStoragePathIdentifier: String

  /// Events
  access(all) event TokensInitialized(name: String, symbol: String, decimals: UInt8, maxSupply: UFix64?)
  access(all) event TokensMinted(amount: UFix64, to: Address)
  access(all) event TokensBurned(amount: UFix64, from: Address)

  /// Vault resource implementing the FungibleToken standard
  access(all) resource Vault: FungibleToken.Vault {
    access(all) var balance: UFix64

    init(balance: UFix64) {
      self.balance = balance
    }

    access(FungibleToken.Withdraw) fun withdraw(amount: UFix64): @{FungibleToken.Vault} {
      pre {
        amount > 0.0: "withdraw amount must be positive"
        self.balance >= amount: "insufficient balance"
      }
      self.balance = self.balance - amount
      return <-create Vault(balance: amount)
    }

    access(all) fun deposit(from: @{FungibleToken.Vault}) {
      let vault: @VaultShareToken.Vault <- from as! @VaultShareToken.Vault
      let amount: UFix64 = vault.balance
      self.balance = self.balance + amount
      destroy vault
    }

    access(all) view fun isAvailableToWithdraw(amount: UFix64): Bool {
      if amount <= 0.0 { return false }
      return self.balance >= amount
    }

    access(all) fun createEmptyVault(): @{FungibleToken.Vault} {
      return <-create Vault(balance: 0.0)
    }

    access(all) view fun getViews(): [Type] {
      return [
        Type<MetadataViews.Display>(),
        Type<FungibleTokenMetadataViews.FTView>(),
        Type<FungibleTokenMetadataViews.FTDisplay>(),
        Type<FungibleTokenMetadataViews.FTVaultData>(),
        Type<FungibleTokenMetadataViews.TotalSupply>()
      ]
    }

    access(all) view fun resolveView(_ view: Type): AnyStruct? {
      switch view {
      case Type<MetadataViews.Display>():
        var desc: String = VaultShareToken.name.concat(" shares for vault ").concat(VaultShareToken.symbol)
        let decs: String = VaultShareToken.decimals.toString()
        desc = desc.concat(" (").concat(decs).concat(" decimals")
        if let ms = VaultShareToken.maxSupply {
          desc = desc.concat(", max ").concat(ms.toString())
        }
        desc = desc.concat(")")
        return MetadataViews.Display(
          name: VaultShareToken.name,
          description: desc,
          thumbnail: MetadataViews.HTTPFile(url: "")
        )
      case Type<FungibleTokenMetadataViews.FTView>():
        let logos: MetadataViews.Medias = MetadataViews.Medias([])
        var desc: String = VaultShareToken.name.concat(" share token")
        let decs: String = VaultShareToken.decimals.toString()
        desc = desc.concat(" (").concat(decs).concat(" decimals")
        if let ms = VaultShareToken.maxSupply {
          desc = desc.concat(", max ").concat(ms.toString())
        }
        desc = desc.concat(")")
        let ftDisplay: FungibleTokenMetadataViews.FTDisplay = FungibleTokenMetadataViews.FTDisplay(
          name: VaultShareToken.name,
          symbol: VaultShareToken.symbol,
          description: desc,
          externalURL: MetadataViews.ExternalURL(""),
          logos: logos,
          socials: {}
        )
        let ftVault: FungibleTokenMetadataViews.FTVaultData = FungibleTokenMetadataViews.FTVaultData(
          storagePath: VaultShareToken.getVaultStoragePath(),
          receiverPath: VaultShareToken.getReceiverPublicPath(),
          metadataPath: VaultShareToken.getBalancePublicPath(),
          receiverLinkedType: Type<&{FungibleToken.Receiver}>(),
          metadataLinkedType: Type<&VaultShareToken.Vault>(),
          createEmptyVaultFunction: (fun(): @{FungibleToken.Vault} { return <-create VaultShareToken.Vault(balance: 0.0) })
        )
        return FungibleTokenMetadataViews.FTView(
          ftDisplay: ftDisplay,
          ftVaultData: ftVault
        )
      case Type<FungibleTokenMetadataViews.FTDisplay>():
        let logos: MetadataViews.Medias = MetadataViews.Medias([])
        var desc2: String = VaultShareToken.name.concat(" share token")
        let decs2: String = VaultShareToken.decimals.toString()
        desc2 = desc2.concat(" (").concat(decs2).concat(" decimals")
        if let ms2 = VaultShareToken.maxSupply {
          desc2 = desc2.concat(", max ").concat(ms2.toString())
        }
        desc2 = desc2.concat(")")
        return FungibleTokenMetadataViews.FTDisplay(
          name: VaultShareToken.name,
          symbol: VaultShareToken.symbol,
          description: desc2,
          externalURL: MetadataViews.ExternalURL(""),
          logos: logos,
          socials: {}
        )
      case Type<FungibleTokenMetadataViews.FTVaultData>():
        return FungibleTokenMetadataViews.FTVaultData(
          storagePath: VaultShareToken.getVaultStoragePath(),
          receiverPath: VaultShareToken.getReceiverPublicPath(),
          metadataPath: VaultShareToken.getBalancePublicPath(),
          receiverLinkedType: Type<&{FungibleToken.Receiver}>(),
          metadataLinkedType: Type<&VaultShareToken.Vault>(),
          createEmptyVaultFunction: (fun(): @{FungibleToken.Vault} { return <-create VaultShareToken.Vault(balance: 0.0) })
        )
      case Type<FungibleTokenMetadataViews.TotalSupply>():
        return FungibleTokenMetadataViews.TotalSupply(totalSupply: VaultShareToken.totalSupply)
      default:
        return nil
      }
    }
  }

  /// Admin resource that can mint/burn tokens
  access(all) resource Admin {
    access(all) fun mint(to: &{FungibleToken.Receiver}, amount: UFix64) {
      pre {
        amount > 0.0: "mint amount must be positive"
        VaultShareToken.maxSupply == nil || VaultShareToken.totalSupply + amount <= VaultShareToken.maxSupply!: "exceeds maxSupply"
      }
      VaultShareToken.totalSupply = VaultShareToken.totalSupply + amount
      let minted: @VaultShareToken.Vault <- create Vault(balance: amount)
      to.deposit(from: <-minted)
      emit TokensMinted(amount: amount, to: to.owner?.address ?? panic("unknown receiver owner"))
    }

    access(all) fun burn(from: auth(FungibleToken.Withdraw) &{FungibleToken.Vault}, amount: UFix64) {
      pre {
        amount > 0.0: "burn amount must be positive"
      }
      let withdrawn: @{FungibleToken.Vault} <- from.withdraw(amount: amount)
      let vault: @VaultShareToken.Vault <- withdrawn as! @Vault
      let burned: UFix64 = vault.balance
      destroy vault
      VaultShareToken.totalSupply = VaultShareToken.totalSupply - burned
      emit TokensBurned(amount: burned, from: from.owner?.address ?? panic("unknown owner"))
    }
  }

  /// Create an empty user vault
  

  /// Borrow the contract's Admin (held in contract account storage)
  access(all) fun borrowAdmin(): &Admin? {
    let adminPath: StoragePath = StoragePath(identifier: self.adminStoragePathIdentifier)!
    return self.account.storage.borrow<&Admin>(from: adminPath)
  }

  /// Paths
  access(all) view fun getVaultStoragePath(): StoragePath {
    return StoragePath(identifier: self.vaultStoragePathIdentifier)!
  }

  access(all) view fun getReceiverPublicPath(): PublicPath {
    return PublicPath(identifier: self.receiverPublicPathIdentifier)!
  }

  access(all) view fun getBalancePublicPath(): PublicPath {
    return PublicPath(identifier: self.balancePublicPathIdentifier)!
  }

  /// Supply helpers
  access(all) view fun getTotalSupply(): UFix64 {
    return self.totalSupply
  }

  /// Init with metadata and optional max supply
  init(name: String, symbol: String, decimals: UInt8, maxSupply: UFix64?) {
    self.name = name
    self.symbol = symbol
    self.decimals = decimals
    self.maxSupply = maxSupply
    self.totalSupply = 0.0

    // Derive unique path identifiers from symbol
    // Use a simple, predictable scheme that keeps identifiers short and compatible
    self.vaultStoragePathIdentifier = "vault_".concat(symbol)
    self.receiverPublicPathIdentifier = "receiver_".concat(symbol)
    self.balancePublicPathIdentifier = "balance_".concat(symbol)
    self.adminStoragePathIdentifier = "admin_".concat(symbol)

    // Create and store admin in the contract account if not present at the derived path
    let adminPath: StoragePath = StoragePath(identifier: self.adminStoragePathIdentifier)!
    if self.account.storage.borrow<&Admin>(from: adminPath) == nil {
      let admin: @Admin <- create Admin()
      self.account.storage.save(<-admin, to: adminPath)
    }

    emit TokensInitialized(name: name, symbol: symbol, decimals: decimals, maxSupply: maxSupply)
  }

  // FungibleToken contract interface requirements
  access(all) view fun getContractViews(resourceType: Type?): [Type] {
    return [
      Type<FungibleTokenMetadataViews.FTView>(),
      Type<FungibleTokenMetadataViews.FTDisplay>(),
      Type<FungibleTokenMetadataViews.FTVaultData>(),
      Type<FungibleTokenMetadataViews.TotalSupply>()
    ]
  }

  access(all) fun resolveContractView(resourceType: Type?, viewType: Type): AnyStruct? {
    switch viewType {
    case Type<FungibleTokenMetadataViews.FTView>():
      let logos: MetadataViews.Medias = MetadataViews.Medias([])
      var desc: String = self.name.concat(" share token")
      let decs: String = self.decimals.toString()
      desc = desc.concat(" (").concat(decs).concat(" decimals")
      if let ms: UFix64 = self.maxSupply {
        desc = desc.concat(", max ").concat(ms.toString())
      }
      desc = desc.concat(")")
      let ftDisplay = FungibleTokenMetadataViews.FTDisplay(
        name: self.name,
        symbol: self.symbol,
        description: desc,
        externalURL: MetadataViews.ExternalURL(""),
        logos: logos,
        socials: {}
      )
      let ftVault = FungibleTokenMetadataViews.FTVaultData(
        storagePath: self.getVaultStoragePath(),
        receiverPath: self.getReceiverPublicPath(),
        metadataPath: self.getBalancePublicPath(),
        receiverLinkedType: Type<&{FungibleToken.Receiver}>(),
        metadataLinkedType: Type<&VaultShareToken.Vault>(),
        createEmptyVaultFunction: (fun(): @{FungibleToken.Vault} { return <-create VaultShareToken.Vault(balance: 0.0) })
      )
      return FungibleTokenMetadataViews.FTView(
        ftDisplay: ftDisplay,
        ftVaultData: ftVault
      )
    case Type<FungibleTokenMetadataViews.FTDisplay>():
      let logos: MetadataViews.Medias = MetadataViews.Medias([])
      var desc2: String = self.name.concat(" share token")
      let decs2: String = self.decimals.toString()
      desc2 = desc2.concat(" (").concat(decs2).concat(" decimals")
      if let ms2: UFix64 = self.maxSupply {
        desc2 = desc2.concat(", max ").concat(ms2.toString())
      }
      desc2 = desc2.concat(")")
      return FungibleTokenMetadataViews.FTDisplay(
        name: self.name,
        symbol: self.symbol,
        description: desc2,
        externalURL: MetadataViews.ExternalURL(""),
        logos: logos,
        socials: {}
      )
    case Type<FungibleTokenMetadataViews.FTVaultData>():
      return FungibleTokenMetadataViews.FTVaultData(
        storagePath: self.getVaultStoragePath(),
        receiverPath: self.getReceiverPublicPath(),
        metadataPath: self.getBalancePublicPath(),
        receiverLinkedType: Type<&{FungibleToken.Receiver}>(),
        metadataLinkedType: Type<&VaultShareToken.Vault>(),
        createEmptyVaultFunction: (fun(): @{FungibleToken.Vault} { return <-create VaultShareToken.Vault(balance: 0.0) })
      )
    case Type<FungibleTokenMetadataViews.TotalSupply>():
      return FungibleTokenMetadataViews.TotalSupply(totalSupply: self.totalSupply)
    default:
      return nil
    }
  }

  // Required by FungibleToken contract interface
  access(all) fun createEmptyVault(vaultType: Type): @{FungibleToken.Vault} {
    pre {
      vaultType == Type<@VaultShareToken.Vault>(): "unsupported vault type"
    }
    return <-create VaultShareToken.Vault(balance: 0.0)
  }
}


