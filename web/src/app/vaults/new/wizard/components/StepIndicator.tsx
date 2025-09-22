"use client";

export default function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className={step === 1 ? "font-semibold" : "text-gray-500"}>
        1. Custody
      </span>
      <span>›</span>
      <span className={step === 2 ? "font-semibold" : "text-gray-500"}>
        2. Select NFT
      </span>
      <span>›</span>
      <span className={step === 3 ? "font-semibold" : "text-gray-500"}>
        3. Configure Vault
      </span>
      <span>›</span>
      <span className={step === 4 ? "font-semibold" : "text-gray-500"}>
        4. Share Supply
      </span>
    </div>
  );
}
