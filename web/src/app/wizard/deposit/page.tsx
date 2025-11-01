"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { guessBrandByTypeId } from "@/lib/nftBrands";
import {
  getNftCollections,
  getCollectionIds,
  getNftDisplay,
  type NftCollectionPublic,
} from "@/lib/api/nft";
import PrismaticBurst from "@/components/PrismaticBurst";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import type { FlowAuthorizationFn } from "@/lib/flow";
import { createVaultAndMintDualTxConfig } from "@/lib/tx/vaults";
import { waitForTransactionSealed } from "@/lib/tx/utils";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

type PublicCol = NftCollectionPublic;

export default function DepositWizardPage() {
  const fcl = useFlowClient();
  const { user } = useFlowCurrentUser();
  const [cols, setCols] = useState<PublicCol[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [ids, setIds] = useState<string[]>([]);
  const [tokenId, setTokenId] = useState<string>("");
  const [vaultId, setVaultId] = useState<string>("");
  const [shareSymbol, setShareSymbol] = useState<string>("");
  const [policy, setPolicy] = useState<string>("standard");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  // Share supply config (UI only for now)
  const [maxSupply, setMaxSupply] = useState<string>("");
  const [initialMint, setInitialMint] = useState<string>("");
  const [indicativePrice, setIndicativePrice] = useState<string>("");
  const [customStake, setCustomStake] = useState<boolean>(false);
  // Prefill from query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("vaultId");
    const s = p.get("symbol");
    const pol = p.get("policy");
    if (v) setVaultId(v);
    if (s) setShareSymbol(s);
    if (pol) setPolicy(pol);
  }, []);

  const [preview, setPreview] = useState<{
    name?: string;
    description?: string;
    thumbnail?: string;
  } | null>(null);

  // Convert public path to storage path for Cadence transaction
  // Uses storagePath from API if available, otherwise falls back to naive conversion
  const storagePath = useMemo(() => {
    if (!selected) return "";
    const col = cols.find((c) => c.publicPath === selected);
    if (col?.storagePath) {
      return col.storagePath;
    }
    // Fallback to naive conversion for backwards compatibility
    if (selected.startsWith("/public/")) {
      return selected.replace("/public/", "/storage/");
    }
    return selected;
  }, [selected, cols]);

  // For UI/logging, extract just the collection name
  const publicId = useMemo(() => {
    if (!selected) return "";
    return selected.split("/").pop() || "";
  }, [selected]);

  const brand = useMemo(() => {
    const tid = cols.find((c) => c.publicPath === selected)?.typeId || "";
    return guessBrandByTypeId(tid);
  }, [cols, selected]);

  const userAuth = useMemo(() => {
    return (
      fcl as unknown as { currentUser(): { authorization: unknown } }
    ).currentUser().authorization;
  }, [fcl]);

  const { adminAuth, adminReady } = useAdminInfo();

  type FclLike = {
    mutate: (cfg: Record<string, unknown>) => Promise<string>;
  };
  const f = fcl as unknown as FclLike;

  useEffect(() => {
    (async () => {
      if (!user?.addr) return;
      const c = await getNftCollections(user.addr);
      setCols(c);
    })();
  }, [user?.addr]);

  // Load IDs when a collection is selected
  useEffect(() => {
    (async () => {
      if (!user?.addr || !publicId) {
        setIds([]);
        setTokenId("");
        return;
      }
      try {
        const list = await getCollectionIds(user.addr, publicId);
        setIds(list || []);
        setTokenId("");
      } catch {
        setIds([]);
        setTokenId("");
      }
    })();
  }, [user?.addr, publicId]);

  useEffect(() => {
    (async () => {
      if (!user?.addr || !publicId || !tokenId) {
        setPreview(null);
        return;
      }
      try {
        const d = await getNftDisplay(user.addr, publicId, tokenId);
        setPreview(d);
      } catch {
        setPreview(null);
      }
    })();
  }, [user?.addr, publicId, tokenId]);

  // Keep Initial Mint locked to Max Supply when not customizing stake
  useEffect(() => {
    if (!customStake) {
      setInitialMint(maxSupply || "");
    }
  }, [customStake, maxSupply]);

  const isNftSelected = Boolean(publicId && tokenId);

  if (user && !user.loggedIn) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-medium">Fractionalize NFT</div>
        </div>
        <div className="rounded border p-4 space-y-3">
          <NotLoggedIn message="Connect your wallet to fractionalize an NFT." />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-lg font-medium">Fractionalize NFT</div>
        <Link
          className="text-xs text-black-500 border rounded px-2 py-1 hover:bg-black/10"
          href="/vaults/new/wizard/step-2"
        >
          mint example NFT
        </Link>
      </div>
      {status && (
        <div className="rounded border border-green-700 bg-green-950/30 p-2 text-sm text-green-300">
          {status}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-700 bg-red-950/30 p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Left: Form steps */}
        <div className="md:col-span-2 space-y-3">
          {/* Step: NFT Selection */}
          <div className="rounded-md border border-neutral-800 p-4 space-y-3 relative bg-neutral-950/95 backdrop-blur-sm">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <PrismaticBurst
                animationType="rotate3d"
                intensity={0.75}
                speed={0.5}
                distort={1.0}
                paused={false}
                offset={{ x: 0, y: 0 }}
                hoverDampness={0.25}
                rayCount={24}
                mixBlendMode="lighten"
                colors={["#b0cfff", "#6da6ff", "#eaf6ff"]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="16"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M3 16l5-5 4 4 3-3 3 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="font-medium text-neutral-100">
                  NFT Selection
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                Required
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Choose the collection and token to fractionalize.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="publicCollections"
                  className="block text-sm mb-1 text-neutral-300"
                >
                  Detected Public Collections
                </label>
                <select
                  id="publicCollections"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Select a collection</option>
                  {cols.map((c) => (
                    <option key={c.publicPath} value={c.publicPath}>
                      {c.publicPath}{" "}
                      {guessBrandByTypeId(c.typeId)?.label
                        ? `— ${guessBrandByTypeId(c.typeId)?.label}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="tokenIdSelect"
                  className="block text-sm mb-1 text-neutral-300"
                >
                  NFT Token ID
                </label>
                <select
                  id="tokenIdSelect"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  disabled={!publicId}
                >
                  <option value="">Select token</option>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      #{id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step: Vault Details */}
          <div
            className={`rounded-md border border-neutral-800 bg-neutral-900 p-4 space-y-3 ${
              !isNftSelected ? "opacity-50 pointer-events-none" : ""
            }`}
            aria-disabled={!isNftSelected}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 10V8a5 5 0 1 1 10 0v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
                <span className="font-medium text-neutral-100">
                  Vault Details
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                Self-custody
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              A Vault is a{" "}
              <a
                href="https://cadence-lang.org/docs/solidity-to-cadence#resources"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-400 hover:text-blue-300"
              >
                Resource
              </a>
              , that securely holds your NFT and issues fractional shares. These
              details identify it on-chain and in the{" "}
              <Link
                href="/marketplace"
                className="underline text-blue-400 hover:text-blue-300 ml-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                Marketplace
              </Link>
              , making it discoverable and tradeable.
            </p>
            <p className="text-xs text-neutral-400">
              Create a vault to fractionalize your NFT, by configuring the
              following details:
            </p>
            <div>
              <label
                htmlFor="vaultIdInput"
                className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
              >
                Vault ID
                <span className="text-neutral-500 text-xs font-normal">
                  (unique identifier)
                </span>
              </label>
              <div className="text-xs text-neutral-500 mb-2">
                Unique name for this vault. Used to reference it in the system.
                Example: &quot;VAULT-MOONBIRD-42&quot; or &quot;PUNK-123&quot;
              </div>
              <input
                id="vaultIdInput"
                className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                placeholder="VAULT001"
                value={vaultId}
                onChange={(e) => setVaultId(e.target.value)}
                disabled={!isNftSelected}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label
                  htmlFor="shareSymbolInput"
                  className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
                >
                  Symbol
                  <span className="text-neutral-500 text-xs font-normal">
                    (ticker)
                  </span>
                </label>
                <div className="text-xs text-neutral-500 mb-2">
                  A short ticker symbol for your fractional shares, like a stock
                  symbol. Example: &quot;MOON&quot; or &quot;PUNK&quot;.
                </div>
                <input
                  id="shareSymbolInput"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="V001"
                  value={shareSymbol}
                  onChange={(e) => setShareSymbol(e.target.value)}
                  disabled={!isNftSelected}
                />
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="policyInput"
                  className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
                >
                  Policy
                  <span className="text-neutral-500 text-xs font-normal">
                    (rules)
                  </span>
                </label>
                <div className="text-xs text-neutral-500 mb-2">
                  Controls how shares can be bought back or traded. &quot;standard&quot;
                  allows flexible transfers.
                </div>
                <input
                  readOnly={true}
                  id="policyInput"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                  value="standard"
                />
              </div>
            </div>
          </div>

          {/* Step: Fraction Supply */}
          <div
            className={`rounded-md border border-neutral-800 bg-neutral-900 p-4 space-y-3 ${
              !isNftSelected ? "opacity-50 pointer-events-none" : ""
            }`}
            aria-disabled={!isNftSelected}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-green-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 7v10M9 10c0-1.105 1.343-2 3-2s3 .895 3 2-1.343 2-3 2-3 .895-3 2 1.343 2 3 2 3-.895 3-2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="font-medium text-neutral-100">
                  Fraction Supply
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                Monetization
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Transform your NFT into tradeable fractions. Set how many
              fractions you&apos;ll create, claim your initial ownership stake, and
              determine the value per fraction. This is where you unlock
              liquidity and let others invest in your NFT.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="maxSupplyInput"
                  className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
                >
                  Max Supply
                  <span className="text-neutral-500 text-xs font-normal">
                    (total fractions)
                  </span>
                </label>
                <div className="text-xs text-neutral-500 mb-2">
                  How many pieces (fractions) your NFT is divided into. Smaller
                  number = larger share value. Larger number = smaller pieces,
                  more accessibility for buyers.
                </div>
                <input
                  id="maxSupplyInput"
                  inputMode="numeric"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="e.g. 1,000,000"
                  value={maxSupply}
                  onChange={(e) => setMaxSupply(e.target.value)}
                  disabled={!isNftSelected}
                />
              </div>
              <div>
                <label
                  htmlFor="initialMintInput"
                  className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
                >
                  Initial Mint Amount
                  <span className="text-neutral-500 text-xs font-normal">
                    (your ownership)
                  </span>
                </label>
                <div className="text-xs text-neutral-500 mb-2">
                  How much of the supply of your new fractions you initially
                  own. Sell the rest on the marketplace. Keep a stake, earn from
                  sales, or maintain full control.
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id="customStake"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={customStake}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCustomStake(checked);
                      if (!checked) {
                        setInitialMint(maxSupply || "");
                      }
                    }}
                  />
                  <label
                    htmlFor="customStake"
                    className="text-xs text-neutral-300"
                  >
                    Customize ownership stake (mint to escrow, then transfer
                    stake)
                  </label>
                </div>
                <input
                  id="initialMintInput"
                  inputMode="numeric"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="e.g. 100,000"
                  value={initialMint}
                  onChange={(e) => setInitialMint(e.target.value)}
                  disabled={!isNftSelected || !customStake}
                />
              </div>
              <div>
                <label
                  htmlFor="indicativePriceInput"
                  className="text-sm mb-1 text-neutral-300 flex items-center gap-2"
                >
                  Indicative Price (FLOW)
                  <span className="text-neutral-500 text-xs font-normal">
                    (per fraction)
                  </span>
                </label>
                <div className="text-xs text-neutral-500 mb-2">
                  What you think each fraction is worth (in FLOW tokens). See
                  your estimated proceeds update in real-time below. This
                  anchors investor interest and helps you discover the true
                  market value of your NFT.
                </div>
                <input
                  id="indicativePriceInput"
                  inputMode="decimal"
                  className="border border-neutral-800 bg-neutral-950 rounded p-2 w-full text-sm text-neutral-100 placeholder:text-neutral-500"
                  placeholder="e.g. 0.25"
                  value={indicativePrice}
                  onChange={(e) => setIndicativePrice(e.target.value)}
                  disabled={!isNftSelected}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                More about Fractionalization:
                <Link
                  href="/docs/shares"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 hover:text-blue-300"
                >
                  here
                </Link>
              </span>
              <span className="text-xs">
                {(() => {
                  const qty = Number(initialMint.replaceAll(",", ""));
                  const px = Number(indicativePrice.replaceAll(",", ""));
                  if (!qty || !px) return null;
                  const est = qty * px;
                  return (
                    <span className="inline-flex items-center gap-1 rounded px-2 py-1 bg-green-900/20 border border-green-800 text-green-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      Est. proceeds:{" "}
                      {est.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      FLOW
                    </span>
                  );
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sticky Summary */}
        <div className="md:col-span-1">
          <div className="md:sticky md:top-4 space-y-3">
            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
              <div className="text-sm font-medium mb-2 text-neutral-200">
                Selected NFT
              </div>
              <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 h-56 flex items-center justify-center">
                {preview?.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.thumbnail}
                    alt={preview?.name || "NFT thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-500 gap-2">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      focusable="false"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="16"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M3 16l5-5 4 4 3-3 3 3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-xs">
                      Select a collection and token to preview
                    </div>
                  </div>
                )}
              </div>
              {preview ? (
                <div className="mt-3 space-y-1">
                  <div className="font-medium text-neutral-100">
                    {preview?.name || "(no name)"}
                  </div>
                  <div className="text-neutral-400 text-sm">
                    {preview?.description || ""}
                  </div>
                  {brand?.label ? (
                    <div className="mt-1 text-xs text-neutral-500">
                      Detected brand: {brand.label}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4 space-y-3">
              <div className="text-sm font-medium text-neutral-100">
                Summary
              </div>
              <div className="text-xs text-neutral-400">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span>Vault ID</span>
                  <span className="text-neutral-200">{vaultId || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span>Symbol</span>
                  <span className="text-neutral-200">
                    {shareSymbol || vaultId || "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span>Policy</span>
                  <span className="text-neutral-200">standard</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span>Max Supply</span>
                  <span className="text-neutral-200">{maxSupply || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span>Initial Mint</span>
                  <span className="text-neutral-200">
                    {initialMint || (customStake ? "—" : maxSupply || "—")}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Indicative Price</span>
                  <span className="text-neutral-200">
                    {indicativePrice ? `${indicativePrice} FLOW` : "—"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    !user?.addr ||
                    !publicId ||
                    !tokenId ||
                    !vaultId ||
                    !adminReady
                  }
                  onClick={async () => {
                    if (!user?.addr) return;
                    setError("");
                    setStatus("Creating vault...");
                    try {
                      if (!adminReady || !adminAuth)
                        throw new Error("Admin not ready");

                      const userAuthFn =
                        userAuth as unknown as FlowAuthorizationFn;

                      const storageIdentifier =
                        (storagePath || "").split("/").pop() || "";

                      const maxSupplyClean = (maxSupply || "").replaceAll(
                        ",",
                        ""
                      );
                      const initialMintClean = (initialMint || "").replaceAll(
                        ",",
                        ""
                      );
                      const stake = customStake
                        ? initialMintClean || "0.0"
                        : initialMintClean || maxSupplyClean;

                      const txCfg = await createVaultAndMintDualTxConfig({
                        vaultId,
                        collectionStoragePath: storageIdentifier,
                        collectionPublicPath: publicId,
                        tokenId,
                        shareSymbol: shareSymbol || vaultId,
                        policy: policy || "standard",
                        maxSupply: maxSupplyClean || null,
                        initialMint: stake || "0.0",
                        creatorAuth: userAuthFn,
                        adminAuth: adminAuth as FlowAuthorizationFn,
                      });

                      console.log(txCfg);

                      const txId = await f.mutate(
                        txCfg as unknown as Record<string, unknown>
                      );

                      await waitForTransactionSealed(fcl, txId);

                      setStatus(`Vault created and shares minted: ${txId}`);

                      setTimeout(() => {
                        if (vaultId) {
                          window.location.href = `/vaults/${encodeURIComponent(
                            vaultId
                          )}`;
                        }
                      }, 800);
                    } catch (e) {
                      setError((e as Error).message);
                      setStatus("");
                    }
                  }}
                >
                  Fractionalize
                </Button>
                {/* <Button asChild variant="outline" size="sm">
                    <Link href="/">Cancel</Link>
                  </Button> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
