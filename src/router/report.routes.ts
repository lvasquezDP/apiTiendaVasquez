import { Router } from "express";
import prisma from "../data";
import { responseSuccess } from "../utils/response";
import { DateTime } from "luxon";

const reportRouter = Router();

reportRouter.get("/dashboard", async (req, res) => {
  const { startDate, endDate } = req.query;

  const TIMEZONE = "America/Mexico_City";

  const start = DateTime.fromISO(startDate as string, {
    zone: TIMEZONE
  }).startOf("day").toUTC().toJSDate();

  const end = DateTime.fromISO(endDate as string, {
    zone: TIMEZONE
  }).endOf("day").toUTC().toJSDate();

  if (!startDate || !endDate) {
    return res.status(400).json({
      code: 400,
      message: "startDate and endDate are required",
      data: null
    });
  }

  console.log(req.query);
  console.log(startDate, endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      message: "Fechas inválidas",
    });
  }

  const whereDate = {
    createdAt: { gte: start, lte: end }
  };

  const salesAgg = await prisma.sale.aggregate({
    _sum: { total: true, extra: true },
    _count: true,
    where: whereDate
  });

  const salesByPayment = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    _sum: { total: true },
    _count: true,
    where: whereDate
  });
  const dailySales: Array<{ date: Date; count: number; total: number }> =
    await prisma.$queryRaw`
      SELECT
      TO_CHAR(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}), 'YYYY-MM-DD') as date,
      COUNT(*)::int as count, SUM(total) as total, SUM(extra) as extra, SUM(comision) as comision
      FROM "Sale"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY 1
      ORDER BY date ASC
    `;

  const productsSoldAgg = await prisma.saleItem.count({
    where: { sale: whereDate }
  });

  const lastSales = await prisma.sale.findMany({
    where: whereDate,
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      items: {
        include: { product: { select: { name: true } } }
      }
    }
  });

  const topProductsRaw = await prisma.saleItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true, subtotal: true },
    where: { sale: whereDate },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5
  });

  const productIds = topProductsRaw.map(p => p.productId);
  const productMap = new Map(
    (await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    })).map(p => [p.id, p.name])
  );

  const topProducts = topProductsRaw.map(p => ({
    productId: p.productId,
    name: productMap.get(p.productId) ?? "Desconocido",
    quantity: p._sum.quantity ?? 0,
    revenue: p._sum.subtotal ?? 0
  }));

  const lowStock = await prisma.product.findMany({
    where: { stock: { lte: 5 } },
    orderBy: { stock: "asc" },
    take: 10,
    select: { id: true, name: true, stock: true, type: true }
  });

  const productsByType = await prisma.product.groupBy({
    by: ["type"],
    _count: true
  });

  const totalSuppliers = await prisma.supplier.count();
  const suppliersWithProducts = await prisma.supplier.count({
    where: { products: { some: {} } }
  });

  return responseSuccess(res, {
    sales: {
      total: salesAgg._sum.total ?? 0,
      count: salesAgg._count,
      extra: salesAgg._sum.extra ?? 0,
      average: salesAgg._count > 0 ? (salesAgg._sum.total ?? 0) / salesAgg._count : 0,
      totalProductsSold: productsSoldAgg ?? 0,
      lastSales: lastSales.map(s => ({
        id: s.id,
        total: s.total,
        extra: s.extra,
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt,
        items: s.items.map(i => ({
          productName: i.product.name,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal
        }))
      })),
      byPaymentMethod: salesByPayment.map(p => ({
        method: p.paymentMethod,
        count: p._count,
        total: p._sum.total ?? 0
      })),
      dailyBreakdown: dailySales
    },
    products: {
      topSelling: topProducts,
      lowStock,
      countByType: Object.fromEntries(
        productsByType.map(p => [p.type, p._count])
      )
    },
    suppliers: {
      total: totalSuppliers,
      withProducts: suppliersWithProducts
    }
  }, "DASHBOARD_DATA");
});

export default reportRouter;