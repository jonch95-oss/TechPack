"use client";

import { useRouter } from "next/navigation";
import { PrintForm } from "@/components/library/print-form";

export function PrintCreated({ brands, materials }: { brands: { id: string; name: string }[]; materials: { id: string; label: string }[] }) {
  const router = useRouter();
  return <PrintForm item={null} brands={brands} materials={materials} canEdit onSaved={(p) => router.replace(`/library/prints/${p.id}`)} />;
}
