import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export type NftCollectionPublic = {
  publicPath: string;
  typeId: string;
  storagePath?: string;
};

export async function getNftCollections(
  account: string
): Promise<NftCollectionPublic[]> {
  const query = `query($network:String!,$account:String!){
    nftCollections(network:$network, account:$account){ publicPath typeId storagePath }
  }`;
  const data = await gqlFetch<{ nftCollections: NftCollectionPublic[] }>(
    query,
    { network: DEFAULT_NETWORK, account }
  );
  return (data.nftCollections || []) as NftCollectionPublic[];
}

export async function getCollectionIds(
  account: string,
  publicPath: string
): Promise<string[]> {
  const query = `query($network:String!,$account:String!,$publicPath:String!){
    collectionIds(network:$network, account:$account, publicPath:$publicPath)
  }`;
  const data = await gqlFetch<{ collectionIds: string[] }>(query, {
    network: DEFAULT_NETWORK,
    account,
    publicPath,
  });
  return data.collectionIds || [];
}

export type NftDisplay = {
  name?: string;
  description?: string;
  thumbnail?: string;
} | null;

export async function getNftDisplay(
  account: string,
  publicPath: string,
  tokenId: string
): Promise<NftDisplay> {
  const query = `query($network:String!,$account:String!,$publicPath:String!,$tokenId:String!){
    nftDisplay(network:$network, account:$account, publicPath:$publicPath, tokenId:$tokenId){ name description thumbnail }
  }`;
  const data = await gqlFetch<{ nftDisplay: NftDisplay }>(query, {
    network: DEFAULT_NETWORK,
    account,
    publicPath,
    tokenId,
  });
  return data.nftDisplay ?? null;
}
