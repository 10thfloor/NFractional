import "NonFungibleToken"

// Resolve storage path identifier for a public collection path by inspecting provider references
access(all) view fun main(account: Address, publicPathIdentifier: String): String? {
  let path = PublicPath(identifier: publicPathIdentifier)!
  let cap = getAccount(account)
    .capabilities.get<&{NonFungibleToken.Provider}>(path)
  if !cap.check() { return nil }
  let borrowed = cap.borrow()
  if borrowed == nil { return nil }
  // There is no direct way to derive storage path from a public capability.
  // Return a conventional guess that many collections follow.
  // Callers may verify separately.
  return publicPathIdentifier
}


