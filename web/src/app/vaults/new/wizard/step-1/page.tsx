"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasNFTCollections } from "@/hooks/useHasNFTCollections";
import { useFlowCurrentUser } from "@onflow/react-sdk";

export default function Step1Page() {
  const { user } = useFlowCurrentUser();
  const { has, loading: colLoading, error: colError } = useHasNFTCollections();

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="font-medium">Step 1 — Set up Custody</div>
      {colLoading ? (
        <div className="text-sm text-gray-500">
          Checking your NFT collections…
        </div>
      ) : null}
      {colError ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-700">
          Could not check collections. You can still continue the wizard.
        </div>
      ) : null}
      <p className="text-sm text-gray-700">
        Your NFT remains in your custody resource. The platform records vault
        metadata and emits events; it never takes possession of your NFT.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="yourFlowAddress" className="block text-sm mb-1">
            Your Flow Address
          </label>
          <Input className="w-full" value={user?.addr || ""} readOnly />
        </div>
      </div>
      {has ? (
        <div className="grid md:grid-cols-2 gap-3">
          <Link
            href={{ pathname: "/wizard/deposit" }}
            className="block border rounded p-4 transition-colors hover:bg-black/10"
          >
            <div className="font-medium">Fractionalize an existing NFT</div>
            <div className="text-sm text-gray-600">
              Detects your collections (Top Shot, Pinnacle, etc.) and imports
              directly.
            </div>
          </Link>
          <div className="border rounded p-4">
            <div className="font-medium">Create a new vault</div>
            <div className="text-sm text-gray-600 mb-2">
              Start with custody setup and continue the current flow.
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/vaults/new/wizard/step-2">Continue</Link>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2">
        {/* <Button
          type="button"
          variant="secondary"
          disabled={loading}
          size="sm"
          onClick={async () => {
            setError(null);
            setSuccess(null);
            setLoading(true);
            try {
              const txId = await setupCustody();
              setSuccess(`Custody setup submitted: ${txId}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Submitting..." : "Set up Custody"}
        </Button> */}
        {!has ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/vaults/new/wizard/step-2">Continue</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
