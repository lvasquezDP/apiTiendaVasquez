import { z } from "zod";

export const productSchema = z.object({
  name: z.string(),
  price: z.coerce.number().positive(),
  realName: z.string().nullable().default(null),
  realPrice: z.coerce.number().positive().nullable().default(null),
  type: z.enum(["UNIT", "WEIGHT"]),
  stock: z.coerce.number().nonnegative(),
  code: z.string(),
  supplierId: z.string().nullable().default(null)
});

export type Product = z.infer<typeof productSchema>;