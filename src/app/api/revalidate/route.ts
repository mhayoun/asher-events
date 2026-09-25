import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";

/** Called by `npm run sync` after it writes to Redis, so the site shows the new events right away. */
export async function POST(request: Request) {
  if (!isAuthorized(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
