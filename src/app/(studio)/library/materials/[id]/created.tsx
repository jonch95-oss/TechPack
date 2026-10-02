"use client";

import { useRouter } from "next/navigation";
import { MaterialForm } from "@/components/library/material-form";

/** New-card flow: once saved, continue on the card's own page. */
export function MaterialCreated() {
  const router = useRouter();
  return <MaterialForm material={null} canEdit onSaved={(m) => router.replace(`/library/materials/${m.id}`)} />;
}
