import ProtectedLayout from "@/app/protected-layout";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
