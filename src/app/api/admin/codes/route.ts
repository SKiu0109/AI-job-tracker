import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import { getRedemptionService } from "@/lib/server/redemption-service";
import type { GenerateCodesRequest } from "@/types/redemption";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const service = getRedemptionService();
  const result = await service.listCodes();
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const body = (await request.json()) as GenerateCodesRequest;

  // Validate
  if (!body.count || body.count < 1 || body.count > 100) {
    return NextResponse.json(
      { error: "生成数量必须在 1-100 之间" },
      { status: 400 }
    );
  }

  if (!body.creditAmount || body.creditAmount < 1 || body.creditAmount > 1000) {
    return NextResponse.json(
      { error: "单码额度必须在 1-1000 之间" },
      { status: 400 }
    );
  }

  if (!body.maxUses || body.maxUses < 1 || body.maxUses > 10000) {
    return NextResponse.json(
      { error: "使用次数必须在 1-10000 之间" },
      { status: 400 }
    );
  }

  if (body.expiresAt && isNaN(Date.parse(body.expiresAt))) {
    return NextResponse.json(
      { error: "过期时间格式不正确" },
      { status: 400 }
    );
  }

  const service = getRedemptionService();
  const result = await service.generateCodes(body, user.id);
  return NextResponse.json(result);
}
