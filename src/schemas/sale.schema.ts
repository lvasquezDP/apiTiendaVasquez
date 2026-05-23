import { z } from "zod";

export const saleSchema = z.object({
  extra: z.coerce.number().nonnegative(),
  paymentMethod: z.enum(["CARD", "CASH"]),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().positive()
    })
  )
});