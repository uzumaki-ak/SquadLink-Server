// translate controller
// single endpoint - translate a piece of text from one language to another

import type { Request, Response, NextFunction } from "express";
import { translateService } from "./translate.service.js";
import { translateTextSchema } from "./translate.types.js";
import { sendSuccess } from "../../utils/response.js";

// POST /translate
// body: { text, sourceLang, targetLang }
// used by: the translate button on chat messages in the android app
async function translate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = translateTextSchema.parse(req.body);
    const translatedText = await translateService.translateText(input);
    sendSuccess(res, { translatedText, targetLang: input.targetLang });
  } catch (err) {
    next(err);
  }
}

export const translateController = { translate };
