import { z } from "zod";

export const ratingSchema = z.object({
  value: z.coerce.number().int("Rating must be a whole number.").min(1).max(5),
});
