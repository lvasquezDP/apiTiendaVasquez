import { Router } from "express";
import { productSchema } from "../schemas/product.schema";
import prisma from "../data";
import { responseSuccess, responseError } from "../utils/response";

const productRouter = Router();

productRouter.post("/", async (req, res) => {
  const result = productSchema.safeParse(req.body);

  if (!result.success) {
    return responseError(res, 400, "DATA_INVALID", result.error);
  }

  const product = await prisma.product.create({
    data: result.data
  });

  return responseSuccess(res, product, "PRODUCT_CREATED");
});

productRouter.get("/", async (req, res) => {
  try {
    const { code = "" } = req.query;
    const products = await prisma.product.findUnique({
      where: { code: String(code) },
      include: {
        supplier: true
      }
    });
    if (!products) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    return responseSuccess(res, products, "PRODUCT_FOUND");
  } catch (error: any) {
    return responseError(res, 404, error.message);
  }
});

productRouter.get("/search", async (req, res) => {
  const { supplierId, minPrice, maxPrice, cursor, limit, name } = req.query;
  const PAGE_SIZE = limit ? Number(limit) : 10;
  const products = await prisma.product.findMany({
    take: PAGE_SIZE + 1,
    ...(cursor ? {
      cursor: { id: String(cursor) },
      skip: 1, // Saltamos el cursor en sí para no repetir el último producto
    } : {}),
    where: {
      ...supplierId && { supplierId: supplierId as string | null },
      price: {
        ...maxPrice ? { lte: Number(maxPrice) } : {},
        ...minPrice ? { gte: Number(minPrice) } : {}
      },
      ...(name ? {
        name: {
          contains: String(name)
        }
      } : {}),
    },
    include: {
      supplier: true
    }
  });
  const hasMore = products.length > PAGE_SIZE;
  const data = hasMore ? products.slice(0, PAGE_SIZE) : products;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]?.id : null;
  return responseSuccess(res, data, "PRODUCTS_FOUND", { nextCursor, hasMore });
});

export default productRouter;