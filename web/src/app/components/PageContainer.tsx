type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function PageContainer({ children, className }: Props) {
  const base = "mx-auto max-w-6xl p-4 space-y-4 bg-neutral-950 text-neutral-200";
  const classes = className ? `${base} ${className}` : base;
  return <main className={classes}>{children}</main>;
}
