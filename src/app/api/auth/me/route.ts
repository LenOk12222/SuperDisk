import { ok, errorToResponse, ApiError } from "@/lib/http";
import { getAuth } from "@/lib/session";
import { publicUser } from "../register/route";

export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) throw new ApiError(401, "unauthorized", "Требуется вход в систему");
    return ok({ user: publicUser(auth.user) });
  } catch (err) {
    return errorToResponse(err);
  }
}
