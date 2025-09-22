"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gqlFetch, DEFAULT_NETWORK } from "@/lib/graphql";
import { getNftCollections, getCollectionIds } from "@/lib/api/nft";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import TxActionButton from "@/app/components/TxActionButton";
import { setupExampleCollectionTx } from "@/lib/tx/nft";
import { useHasNFTCollections } from "@/hooks/useHasNFTCollections";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

async function fetchCollections(account: string) {
  const nftCollections = await getNftCollections(account);
  return { nftCollections };
}

async function fetchCollectionIds(account: string, publicPath: string) {
  const collectionIds = await getCollectionIds(account, publicPath);
  return { collectionIds };
}

export default function Step2Page() {
  const { user } = useFlowCurrentUser();
  const { has } = useHasNFTCollections();
  const fcl = useFlowClient();
  const [selectedPublicPath, setSelectedPublicPath] = useState("");
  const [collections, setCollections] = useState<
    { publicPath: string; typeId: string }[]
  >([]);
  const [ids, setIds] = useState<string[]>([]);
  const [vaultsMine, setVaultsMine] = useState<
    { vaultId: string; tokenId: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pubIdent = useMemo(
    () =>
      selectedPublicPath.startsWith("/public/")
        ? selectedPublicPath.split("/").pop() || ""
        : selectedPublicPath,
    [selectedPublicPath]
  );
  const isExampleSelected = useMemo(
    () => pubIdent === "exampleNFTCollection",
    [pubIdent]
  );
  const userAuth = useMemo(
    () =>
      (
        fcl as unknown as {
          currentUser(): { authorization: unknown };
        }
      ).currentUser().authorization,
    [fcl]
  );

  useEffect(() => {
    (async () => {
      const c = await fetchCollections(user?.addr || "");
      setCollections(c.nftCollections || []);
      if (user?.addr) {
        const q =
          "query($network:String!,$creator:String!){ vaultsByCreator(network:$network, creator:$creator){ vaultId tokenId } }";
        try {
          const d = await gqlFetch<{
            vaultsByCreator: { vaultId: string; tokenId: string | null }[];
          }>(q, { network: DEFAULT_NETWORK, creator: user.addr });
          setVaultsMine(d.vaultsByCreator || []);
        } catch {
          // ignore error; keep empty
        }
      }
    })();
  }, [user?.addr]);

  useEffect(() => {
    (async () => {
      if (!pubIdent || !user?.addr) {
        setIds([]);
        return;
      }
      const d = await fetchCollectionIds(user.addr, pubIdent);
      setIds(d.collectionIds || []);
    })();
  }, [pubIdent, user?.addr]);

  const eligibleIds = useMemo(() => {
    const taken = new Set(
      (vaultsMine || []).map((v) => String(v.tokenId || ""))
    );
    return (ids || []).filter((id) => !taken.has(String(id)));
  }, [ids, vaultsMine]);

  if (user && !user.loggedIn) {
    return (
      <section className="rounded border p-4 space-y-3">
        <div className="font-medium">Mint an ExampleNFT</div>
        <NotLoggedIn message="Connect your wallet to mint NFTs and create vaults." />
      </section>
    );
  }

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="font-medium">Mint an ExampleNFT</div>
      <div className="text-sm text-gray-600">
        Mint an example NFT to get started.
      </div>
      {has ? (
        <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
          Already have eligible NFTs? You can also{" "}
          <Link className="underline" href={{ pathname: "/wizard/deposit" }}>
            fractionalize an existing NFT
          </Link>
          .
        </div>
      ) : null}
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-700">
          {success}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="collectionPublicPath" className="block text-sm mb-1">
            Collection Public Path
          </label>
          <Select
            value={selectedPublicPath}
            onValueChange={(v) => setSelectedPublicPath(v)}
          >
            <SelectTrigger size="sm">
              <SelectValue
                placeholder={
                  collections.length === 0
                    ? "No public collections found"
                    : "Select a public path"
                }
              />
            </SelectTrigger>
            <SelectContent align="start">
              {collections.map((c) => (
                <SelectItem key={c.publicPath} value={c.publicPath}>
                  {c.publicPath}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="eligibleIds" className="block text-sm mb-1">
            Eligible NFTs
          </label>
          <div className="border rounded p-2 h-40 overflow-auto text-sm">
            {eligibleIds.length === 0 ? (
              <div className="text-gray-500">No eligible tokens found</div>
            ) : (
              <ul className="space-y-1">
                {eligibleIds.map((id) => (
                  <li key={id}>Token #{id}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3">
            <div className="text-sm font-medium">Already fractionalized</div>
            <div className="mt-1 border rounded p-2 h-28 overflow-auto text-sm">
              {vaultsMine.length === 0 ? (
                <div className="text-gray-500">None</div>
              ) : (
                <ul className="space-y-1">
                  {vaultsMine.map((v) => (
                    <li key={v.vaultId}>
                      vault {v.vaultId} · token {v.tokenId ?? "?"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TxActionButton
              label="Setup ExampleNFT Collection"
              variant="secondary"
              disabled={collections.length !== 0}
              transaction={{
                cadence: setupExampleCollectionTx(),
                args: () => [],
                authorizations: [userAuth as unknown as never],
                limit: 9999,
              }}
              mutation={{
                mutationKey: ["setup-example-collection"],
                onSuccess: async () => {
                  if (!user?.addr || !pubIdent) return;
                  const d = await fetchCollectionIds(user.addr, pubIdent);
                  setIds(d.collectionIds || []);
                },
                onError: (e: unknown) => setError((e as Error).message),
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isExampleSelected || loading}
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setLoading(true);
                try {
                  const API =
                    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
                  const res = await fetch(`${API}/dev/mint-example`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ recipient: user?.addr || "" }),
                  });
                  if (!res.ok) throw new Error(await res.text());
                  const { txId } = await res.json();
                  setSuccess(`Mint submitted: ${txId}`);
                  if (user?.addr && pubIdent) {
                    const d = await fetchCollectionIds(user.addr, pubIdent);
                    setIds(d.collectionIds || []);
                  }
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Mint ExampleNFT (dev)
            </Button>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/wizard/deposit">Done</Link>
        </Button>
        <Button
          asChild
          size="sm"
          disabled={eligibleIds.length === 0}
          variant="secondary"
        >
          {/* <Link
            href={{
              pathname: "/vaults/new/wizard/step-3",
              query: { publicPath: pubIdent, tokenId: eligibleIds },
            }}
          >
            Continue
          </Link> */}
        </Button>
      </div>
    </section>
  );
}
