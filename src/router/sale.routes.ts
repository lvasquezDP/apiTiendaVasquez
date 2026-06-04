import { Router } from "express";
import { saleSchema } from "../schemas/sale.schema";
import prisma from "../data";
import { responseError, responseSuccess } from "../utils/response";
import { DateTime } from "luxon";

const saleRouter = Router();

saleRouter.post("/", async (req, res) => {
  const result = saleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { items, extra, comision } = result.data;

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let total = 0;

      const saleItemsData: any = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        // if (product.stock < item.quantity) {
        //   throw new Error(`Stock insuficiente para ${product.name}`);
        // }

        const subtotal = (product.type === "WEIGHT" ? (product.price * item.quantity) / 1000 : product.price * item.quantity);

        total += subtotal;

        saleItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          price: product.price,
          subtotal
        });

        // actualizar stock
        // await tx.product.update({
        //   where: { id: product.id },
        //   data: {
        //     stock: product.stock - item.quantity
        //   }
        // });
      }

      return await tx.sale.create({
        data: {
          total,
          extra,
          comision,
          items: {
            create: saleItemsData
          }
        }
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
    createdAt: sale.createdAt,
    items: sale.items.map(item => ({
      name: item.product.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal
    })),
    total: sale.total,
    comision: sale.comision,
    extra: sale.extra,
    paymentMethod: sale.paymentMethod,

  };

  return responseSuccess(res, ticket, "TICKET_GENERATED");
});

saleRouter.get("/search", async (req, res) => {
  const { startDate, endDate, minTotal, maxTotal, cursor, limit } = req.query;
  const TIMEZONE = "America/Mexico_City";

  const PAGE_SIZE = limit ? Number(limit) : 10;
  const sales = await prisma.sale.findMany({
    take: PAGE_SIZE + 5,
    ...(cursor ? {
      cursor: { id: cursor as string },
      skip: 1,
    } : {}),
    where: {
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? {
            gte: DateTime.fromISO(startDate as string, { zone: TIMEZONE }).startOf("day").toUTC().toJSDate()
          } : {}),
          ...(endDate ? {
            lte: DateTime.fromISO(endDate as string, { zone: TIMEZONE }).endOf("day").toUTC().toJSDate()
          } : {}),
        }
      } : {}),

      // ...(minTotal || maxTotal ? {
      //   total: {
      //     ...(minTotal ? { gte: Number(minTotal) } : {}),
      //     ...(maxTotal ? { lte: Number(maxTotal) } : {}),
      //   }
      // } : {})
    },
    // include: {
    //   items: {
    //     include: {
    //       product: true
    //     }
    //   }
    // },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" }
    ]
  });

  const filteredSales = sales.filter(sale => {
    const rangoVenta = sale.total + sale.extra;

    const cumpleMin = minTotal ? rangoVenta >= Number(minTotal) : true;
    const cumpleMax = maxTotal ? rangoVenta <= Number(maxTotal) : true;

    return cumpleMin && cumpleMax;
  }).slice(0, PAGE_SIZE + 1)

  const hasMore = filteredSales.length > PAGE_SIZE;
  const data = hasMore ? filteredSales.slice(0, PAGE_SIZE) : filteredSales;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]?.id : null;
  return responseSuccess(res, data, "SALES_FOUND", { nextCursor, hasMore });
});
export default saleRouter;