import { NextResponse } from "next/server";
import { LANGUAGE_COOKIE_KEY } from "@/lib/i18n/constants";
import { Language } from "@/lib/i18n/dictionary";
import { apiHandler } from "@/lib/api/error-handler";

export const GET = apiHandler((request: Request) => {
  const url = new URL(request.url);
  const requestedLanguage = url.searchParams.get("language");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));
  const language: Language = requestedLanguage === "zh" ? "zh" : "en";
  const response = NextResponse.redirect(new URL(nextPath, request.url));

  response.cookies.set(LANGUAGE_COOKIE_KEY, language, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });

  return response;
});

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}
