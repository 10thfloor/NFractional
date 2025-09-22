"use client";

import { useEffect, useMemo, useState } from "react";
import { getNftDisplay } from "@/lib/api/nft";

export default function NftHeader({
  creator,
  tokenId,
  collection,
}: {
  creator: string | null;
  tokenId: string | null;
  collection: string | null;
}) {
  const publicPathIdentifier = useMemo(() => {
    if (!collection) return undefined;
    // Minimal mapping for ExampleNFT; extend if additional collections are supported
    if (collection.toLowerCase().includes("examplenft")) {
      return "exampleNFTCollection";
    }
    return undefined;
  }, [collection]);

  const enabled = Boolean(creator && tokenId && publicPathIdentifier);
  const [nft, setNft] = useState<{
    name?: string;
    description?: string;
    thumbnail?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!enabled) {
        setNft(null);
        return;
      }
      try {
        const d = await getNftDisplay(
          creator || "",
          publicPathIdentifier || "",
          tokenId || "0"
        );
        if (!cancelled) setNft(d ?? null);
      } catch {
        if (!cancelled) setNft(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, creator, tokenId, publicPathIdentifier]);

  // Always render something, even if no NFT data
  return (
    <div className="flex items-start gap-4">
      <div className="w-24 h-24 border rounded border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
        {nft?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.thumbnail}
            alt={nft?.name || "NFT"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-400 text-2xl">🖼️</div>
        )}
      </div>
      <div className="flex-1">
        {nft?.name ? (
          <div className="text-sm text-gray-600 font-medium">{nft.name}</div>
        ) : (
          <div className="text-sm text-gray-400">No NFT data</div>
        )}
        {nft?.description ? (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {nft.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
