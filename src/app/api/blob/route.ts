import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/dal";
import { usingBlob } from "@/lib/storage";

/** Issues client-upload tokens so large files go straight from the browser to Vercel Blob. */
export async function POST(request: Request) {
  if (!usingBlob()) return NextResponse.json({ error: "Blob storage not configured" }, { status: 501 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        if (!user || !can(user, "designer")) throw new Error("Not allowed");
        return { maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
