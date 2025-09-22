import "NonFungibleToken"
import "ExampleNFT"

transaction {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
    if signer.storage.borrow<&ExampleNFT.Collection>(from: ExampleNFT.CollectionStoragePath) == nil {
      let collection: @{NonFungibleToken.Collection} <- ExampleNFT.createEmptyCollection(nftType: Type<@ExampleNFT.NFT>())
      signer.storage.save(<-collection, to: ExampleNFT.CollectionStoragePath)
      let _: Capability? = signer.capabilities.unpublish(ExampleNFT.CollectionPublicPath)
      let cap: Capability<&ExampleNFT.Collection> = signer.capabilities.storage.issue<&ExampleNFT.Collection>(ExampleNFT.CollectionStoragePath)
      signer.capabilities.publish(cap, at: ExampleNFT.CollectionPublicPath)
    }
  }
}