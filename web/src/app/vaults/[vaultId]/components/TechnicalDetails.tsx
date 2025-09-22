"use client";

import { useState } from "react";
import type { Vault } from "@/lib/api/vault";

interface TechnicalDetailsProps {
  vault: Vault;
  maxSupply?: string | null;
}

export default function TechnicalDetails({
  vault,
  maxSupply,
}: TechnicalDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAddress = (address: string | null) => {
    if (!address) return "—";
    if (address.length <= 20) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-800 transition-colors"
      >
        <span className="text-sm font-medium text-gray-300">
          Technical Details
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-sm">
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs mb-1">
                  Collection Contract
                </div>
                <div className="font-mono text-gray-100 break-all">
                  {vault.collection || "—"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Token ID</div>
                <div className="font-mono text-gray-100">
                  {vault.tokenId || "—"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Creator</div>
                <div className="font-mono text-gray-100">
                  {formatAddress(vault.creator)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs mb-1">Custody Status</div>
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    vault.collection && vault.tokenId
                      ? "bg-green-900 text-green-300"
                      : "bg-amber-900 text-amber-300"
                  }`}
                >
                  {vault.collection && vault.tokenId ? "Ready" : "Not Set Up"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Max Supply</div>
                <div className="font-mono text-gray-100">
                  {maxSupply || "—"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Policy</div>
                <div className="text-gray-100">{vault.policy || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
