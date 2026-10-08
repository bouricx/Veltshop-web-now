import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  image: z.string().trim().max(2048).nullable().optional(),
});
