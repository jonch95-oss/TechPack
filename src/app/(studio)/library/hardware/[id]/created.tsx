"use client";

import { useRouter } from "next/navigation";
import { HardwareForm } from "@/components/library/hardware-form";

export function HardwareCreated({ brands }: { brands: { id: string; name: string }[] }) {
  const router = useRouter();
  return <HardwareForm item={null} brands={brands} canEdit onSaved={(h) => router.replace(`/library/hardware/${h.id}`)} />;
}
