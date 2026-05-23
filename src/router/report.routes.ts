import { Router } from "express";
import prisma from "../data";
import { responseSuccess } from "../utils/response";

const reportRouter = Router();

reportRouter.get("/dashboard", async (req, res) => {
  const { startOfDay, endOfDay } = req.query;
  const todaySales = await prisma.sale.aggregate({
    _sum: {
      total: true
    },
    _count: true,
    where: {
      createdAt: {
        gte: new Date(startOfDay as string),
        lte: new Date(endOfDay as string)
      }
    }
  });
  const productsSold = await prisma.saleItem.aggregate({
    _sum: {
      quantity: true
    },
    where: {
      sale: {
        createdAt: {
          gte: new Date(startOfDay as string),
          lte: new Date(endOfDay as string)
        }
      }
    }
  });
  const lowStock = await prisma.product.findMany({
    where: {
      stock: {
        lte: 5
      }
    },
    take: 10,
    orderBy: {
      stock: "asc"
    }
  });
  const topProducts = await prisma.saleItem.groupBy({
    by: ["productId"],
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: "desc"
      }
    },
    take: 5
  });
  return responseSuccess(res, {
    todaySales,
    productsSold,
    lowStock,
    topProducts
  }, "DASHBOARD_DATA");
});

export default reportRouter;