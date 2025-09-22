"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFlowClient, useFlowCurrentUser } from "@onflow/react-sdk";
import { useAdminInfo } from "@/hooks/useAdminInfo";
import type { FlowAuthorizationFn } from "@/lib/flow";
import { createVaultFromNFTDualTxConfig } from "@/lib/tx/vaults";
import TxActionButton from "@/app/components/TxActionButton";
import NotLoggedIn from "@/components/ui/NotLoggedIn";

export default function Step3Page() {
  const params = useSearchParams();
  const publicPath = params.get("publicPath") || "";

  const fcl = useFlowClient();
  const { user } = useFlowCurrentUser();
  const { adminAuth, adminReady } = useAdminInfo();

  const userAuth = useMemo(
    () =>
      (
        fcl as unknown as {
          currentUser(): { authorization: unknown };
        }
      ).currentUser().authorization,
    [fcl]
  );

  const [vaultId, setVaultId] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [shareSymbol, setShareSymbol] = useState("");
  const [policy, setPolicy] = useState("buyoutOnly");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit =
    publicPath.trim().length > 0 &&
    vaultId.trim().length > 0 &&
    tokenId.trim().length > 0 &&
    shareSymbol.trim().length > 0 &&
    adminReady;

  if (user && !user.loggedIn) {
    return (
      <section className="rounded border p-4 space-y-3">
        <div className="font-medium">Step 3 — Configure Vault</div>
        <NotLoggedIn message="Connect your wallet to configure a vault." />
      </section>
    );
  }

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="font-medium">Step 3 — Configure Vault</div>
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
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="vaultId" className="block text-sm mb-1">
            Vault ID
          </label>
          <Input
            id="vaultId"
            className="w-full"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            placeholder="e.g. VAULT-001"
          />
        </div>
        <div>
          <label htmlFor="tokenId" className="block text-sm mb-1">
            Token ID
          </label>
          <Input
            id="tokenId"
            className="w-full"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="UInt64"
          />
        </div>
        <div>
          <label htmlFor="shareSymbol" className="block text-sm mb-1">
            Share Symbol
          </label>
          <Input
            id="shareSymbol"
            className="w-full"
            value={shareSymbol}
            onChange={(e) => setShareSymbol(e.target.value)}
            placeholder="e.g. VAULT001"
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="publicPath" className="block text-sm mb-1">
            Collection Public Path
          </label>
          <Input
            id="publicPath"
            className="w-full"
            value={publicPath}
            readOnly
          />
        </div>
        <div>
          <label htmlFor="policy" className="block text-sm mb-1">
            Policy
          </label>
          <Select value={policy} onValueChange={(v) => setPolicy(v)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="buyoutOnly">buyoutOnly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/vaults/new/wizard/step-2">Back</Link>
        </Button>
        {adminReady && (
          <TxActionButton
            type="button"
            variant="secondary"
            size="sm"
            label="Create Vault"
            disabled={!canSubmit || !adminReady}
            transaction={(() => {
              const storageIdent = publicPath.split("/").pop() || publicPath;
              return createVaultFromNFTDualTxConfig({
                vaultId,
                collectionStoragePath: storageIdent,
                collectionPublicPath: publicPath,
                tokenId,
                shareSymbol,
                policy,
                creatorAuth: userAuth as unknown as FlowAuthorizationFn,
                adminAuth: adminAuth as unknown as FlowAuthorizationFn,
              });
            })()}
            mutation={{
              mutationKey: ["create-vault", vaultId],
              onSuccess: (txId: string) => setSuccess(txId),
              onError: (e: unknown) => setError((e as Error).message),
            }}
          />
        )}
        <Button asChild size="sm">
          <Link href="/vaults/new/wizard/step-4">Continue</Link>
        </Button>
      </div>
    </section>
  );
}
