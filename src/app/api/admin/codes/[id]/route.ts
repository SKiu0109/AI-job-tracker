import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import { getRedemptionService } from "@/lib/server/redemption-service";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const { id } = await params;

  const body = (await request.json()) as {
    isActive?: boolean;
    note?: string;
  };

  const service = getRedemptionService();
  const result = await service.updateCode(id, {
    isActive: body.isActive,
    note: body.note
  });

  if (!result) {
    return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "无权限访问" }, { status: 403 });
  }

  const { id } = await params;

  const service = getRedemptionService();
  const code = await service.getCode(id);
  const redemptions = await service.getRedemptions(id);

  if (!code) {
    return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
  }

  return NextResponse.json({ code, redemptions });
}
