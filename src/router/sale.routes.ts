import { Router } from "express";
import { saleSchema } from "../schemas/sale.schema";
import prisma from "../data";
import { responseError, responseSuccess } from "../utils/response";

const saleRouter = Router();

saleRouter.post("/", async (req, res) => {
  const result = saleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { items } = result.data;

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let total = 0;

      const saleItemsData: any = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        if (product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}`);
        }

        const subtotal = product.price * item.quantity;

        total += subtotal;

        saleItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          subtotal
        });

        // actualizar stock
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: product.stock - item.quantity
          }
        });
      }

      return await tx.sale.create({
        data: {
          total,
          items: {
            create: saleItemsData
          }
        },
        include: { items: true }
      });
    });

    return responseSuccess(res, sale, "SALE_CREATED");

  } catch (error: any) {
    return responseError(res, 400, error.message);
  }
});

saleRouter.get("/ticket/:id", async (req, res) => {
  const { id } = req.params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!sale) {
    return responseError(res, 404, "SALE_NOT_FOUND");
  }

  const ticket = {
    id: sale.id,
    fecha: sale.createdAt,
    items: sale.items.map(item => ({
      producto: item.product.name,
      cantidad: item.quantity,
      precio: item.price,
      subtotal: item.subtotal
    })),
    total: sale.total
  };

  return responseSuccess(res, ticket, "TICKET_GENERATED");
});

saleRouter.get("/", async (_req, res) => {
  const sales = await prisma.sale.findMany({
    include: {
      items: {
        include: {
          product: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return responseSuccess(res, sales, "SALES_FOUND");
});
export default saleRouter;