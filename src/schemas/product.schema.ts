import { z } from "zod";

export const productSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
  type: z.enum(["UNIT", "WEIGHT"]),
  stock: z.number().nonnegative(),
  code: z.string(),
  supplierId: z.string().nullable()
});

export type Product = z.infer<typeof productSchema>;