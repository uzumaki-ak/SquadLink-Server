// extends express Request type so req.user is available after auth middleware
// without this, typescript would complain about req.user not existing

import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user: Pick<User, "id" | "username" | "languageCode">;
    }
  }
}
