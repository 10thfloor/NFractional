import "FungibleToken"
import "ConstantProductAMM"

// Compute share reserve proportion attributable to team LP for a specific pool
// Returns: shareReserve * (sumTeamLP / totalLP); 0.0 if no LP
access(all) view fun main(owner: Address, poolId: String, team: [Address]): UFix64 {
  let publicPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
  let cap: Capability<&ConstantProductAMM.Pool> = getAccount(owner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
  if !cap.check() { return 0.0 }
  let pool: &ConstantProductAMM.Pool = cap.borrow() ?? panic("invalid pool cap")

  let reserves: {String: UFix64} = pool.reserves()
  let shareReserve: UFix64 = reserves["share"] ?? 0.0
  let totalLP: UFix64 = pool.getTotalLP()
  if totalLP == 0.0 || shareReserve == 0.0 { return 0.0 }

  var teamLP: UFix64 = 0.0
  let lpPubId: String = "AMM_LP_".concat(poolId)
  let lpPub: PublicPath = PublicPath(identifier: lpPubId)!
  var i: Int = 0
  while i < team.length {
    let acct: Address = team[i]
    let capLP: Capability<&ConstantProductAMM.LPVault> = getAccount(acct).capabilities.get<&ConstantProductAMM.LPVault>(lpPub)
    if let lp = capLP.borrow() {
      teamLP = teamLP + lp.getBalance()
    }
    i = i + 1
  }

  if teamLP == 0.0 { return 0.0 }
  return shareReserve * (teamLP / totalLP)
}


