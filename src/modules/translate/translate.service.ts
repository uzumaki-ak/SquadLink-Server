// proxies translation requests to mymemory
// we call from the backend (not android) so the email param stays private
// mymemory: 5000 chars/day anonymous, 50000/day with email registered

import { env } from "../../config/env.js";
import { AppError } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import type { TranslateTextInput, MyMemoryResponse } from "./translate.types.js";

const MYMEMORY_BASE_URL = "https://api.mymemory.translated.net/get";
const FETCH_TIMEOUT_MS = 8000; // mymemory can be slow, give it 8 seconds

// translates text via mymemory - langpair format is "en|hi" (source|target)
async function translateText(input: TranslateTextInput): Promise<string> {
  const langPair =
    input.sourceLang === "autodetect"
      ? `autodetect|${input.targetLang}`
      : `${input.sourceLang}|${input.targetLang}`;

  // build url - add email if configured for higher daily quota
  const url = new URL(MYMEMORY_BASE_URL);
  url.searchParams.set("q", input.text);
  url.searchParams.set("langpair", langPair);
  if (env.MYMEMORY_EMAIL) {
    url.searchParams.set("de", env.MYMEMORY_EMAIL);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new AppError("translation service timed out", 504, "TRANSLATE_TIMEOUT");
    }
    logger.error("mymemory fetch failed", { error: (err as Error).message });
    throw new AppError("translation service unreachable", 502, "TRANSLATE_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    logger.warn("mymemory returned non-ok status", { status: response.status });
    throw new AppError("translation service returned an error", 502, "TRANSLATE_ERROR");
  }

  let data: MyMemoryResponse;
  try {
    data = await response.json() as MyMemoryResponse;
  } catch {
    throw new AppError("invalid response from translation service", 502, "TRANSLATE_PARSE_ERROR");
  }

  // mymemory returns 200 with a non-200 responseStatus for quota errors
  if (data.responseStatus !== 200) {
    logger.warn("mymemory api error", { status: data.responseStatus, message: data.responseMessage });

    if (data.responseStatus === 429 || data.responseMessage?.toLowerCase().includes("quota")) {
      throw new AppError("daily translation quota reached, try again tomorrow", 429, "TRANSLATE_QUOTA_EXCEEDED");
    }
    throw new AppError("translation failed", 502, "TRANSLATE_ERROR");
  }

  const translated = data.responseData?.translatedText;
  if (!translated) {
    throw new AppError("no translation returned", 502, "TRANSLATE_EMPTY");
  }

  return translated;
}

export const translateService = { translateText };
