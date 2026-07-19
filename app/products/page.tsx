import ProductsClient from "@/components/ProductsClient";
import { Suspense } from "react";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full bg-white min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <ProductsClient />
    </Suspense>
  );
}
