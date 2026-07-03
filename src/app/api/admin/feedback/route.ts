import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  getBearerToken,
  verifySupabaseAccessToken
} from "@/lib/auth/server-auth";
import { apiHandler } from "@/lib/api/error-handler";
import { getProductValidationService } from "@/lib/server/product-validation-service";

export const runtime = "nodejs";

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const result = await getProductValidationService().listFeedback();
  return NextResponse.json(result);
});
