"use client";

import { useEffect, useState } from "react";
import { useFlowCurrentUser } from "@onflow/react-sdk";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";

export function useHasNFTCollections() {
  const { user } = useFlowCurrentUser();
  const [has, setHas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.addr) {
        setHas(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const q =
          "query($network:String!,$account:String!){ nftCollections(network:$network, account:$account){ publicPath } }";
        const d = await gqlFetch<{ nftCollections: { publicPath: string }[] }>(
          q,
          { network: DEFAULT_NETWORK, account: user.addr }
        );
        setHas((d.nftCollections || []).length > 0);
      } catch (e) {
        setError((e as Error).message);
        setHas(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.addr]);

  return { has, loading, error, userAddr: user?.addr || "" } as const;
}
