import SalesDashboardClient from "@/components/SalesDashboardClient";
import { verifySession } from "@/lib/auth/dal";

export const metadata = {
  title: "Sales Dashboard | Gembira Momento",
  description: "Monitor transactions, products sold, and staff on duty",
};

export default async function SalesDashboardPage() {
  const session = await verifySession();
  return <SalesDashboardClient role={session.role} />;
}
