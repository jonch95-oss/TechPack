import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/dal";
import { usingBlob } from "@/lib/storage";

const FOLDERS = /^(renders|references|swatches|hardware|prints|brands|logos|imports|misc)\//;

/**
 * Presigned uploads for large files: the browser PUTs straight into the private Blob store
 * (authenticated server-side with Vercel OIDC), scoped to one pathname for ten minutes.
 */
export async function POST(request: Request) {
  if (!usingBlob()) return NextResponse.json({ error: "Blob storage not configured" }, { status: 501 });
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || !can(user, "designer")) throw new Error("Not allowed");
        if (!FOLDERS.test(pathname) || pathname.includes("..")) throw new Error("Bad path");
        const maximumSizeInBytes = 100 * 1024 * 1024;
        const token = await issueSignedToken({ pathname, operations: ["put"], validUntil: Date.now() + 10 * 60_000, maximumSizeInBytes });
        return { token, urlOptions: { access: "private", maximumSizeInBytes, allowOverwrite: false } };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
