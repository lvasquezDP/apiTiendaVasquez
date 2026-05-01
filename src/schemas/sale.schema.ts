import { z } from "zod";

export const saleSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().positive()
    })
  )
});