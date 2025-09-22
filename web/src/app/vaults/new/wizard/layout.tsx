export default function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200">{children}</main>;
}
