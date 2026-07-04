import ProtectedLayout from "@/app/protected-layout";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
