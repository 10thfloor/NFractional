import "MetadataViews"
import "ExampleNFT"

transaction(recipient: Address, name: String, description: String, thumbnail: String) {
  prepare(signer: auth(Storage) &Account) {
    let minterRef: &ExampleNFT.NFTMinter = signer.storage.borrow<&ExampleNFT.NFTMinter>(from: ExampleNFT.MinterStoragePath)
      ?? panic("missing ExampleNFT minter")
    let royalties: [MetadataViews.Royalty] = []
    let nft: @ExampleNFT.NFT <- minterRef.mintNFT(name: name, description: description, thumbnail: thumbnail, royalties: royalties)
    let recipientAcct: &Account = getAccount(recipient)
    let colCap: Capability<&ExampleNFT.Collection> = recipientAcct.capabilities.get<&ExampleNFT.Collection>(ExampleNFT.CollectionPublicPath)
    let colRef: &ExampleNFT.Collection = colCap.borrow() ?? panic("recipient missing ExampleNFT.Collection public capability")
    colRef.deposit(token: <- nft)
  }
}





