import { Router } from "express";
import prisma from "../data";
import { responseSuccess } from "../utils/response";
import { DateTime } from "luxon";
import { Prisma } from "../generated/prisma/client";

const reportRouter = Router();

reportRouter.get("/dashboard", async (req, res) => {
  const { startDate, endDate } = req.query;

  const supplierId =
    typeof req.query.supplierId === "string"
      ? req.query.supplierId
      : undefined;

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

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      message: "Fechas inválidas",
    });
  }

  const whereDate = {
    createdAt: { gte: start, lte: end }
  };

  // Ventas que incluyen al menos un item de ese proveedor
  const whereSale = {
    ...whereDate,
    ...(supplierId
      ? { items: { some: { product: { supplierId } } } }
      : {})
  };

  // ---------- Totales de ventas ----------
  // Sin supplierId: total real de la venta.
  // Con supplierId: total prorrateado = suma de subtotal de items de ese proveedor.
  let salesTotal = 0;
  let salesExtra = 0;
  let salesCount = 0;

  if (supplierId) {
    const [proratedAgg, saleCount] = await Promise.all([
      prisma.saleItem.aggregate({
        _sum: { subtotal: true },
        where: { product: { supplierId }, sale: whereDate }
      }),
      prisma.sale.count({ where: whereSale })
    ]);
    salesTotal = proratedAgg._sum.subtotal ?? 0;
    salesCount = saleCount;
    salesExtra = 0; // "extra" es a nivel de venta completa, no se puede prorratear por producto
  } else {
    const agg = await prisma.sale.aggregate({
      _sum: { total: true, extra: true },
      _count: true,
      where: whereDate
    });
    salesTotal = agg._sum.total ?? 0;
    salesExtra = agg._sum.extra ?? 0;
    salesCount = agg._count;
  }

  // ---------- Ventas por método de pago ----------
  let salesByPayment: { method: string; count: number; total: number }[];

  if (supplierId) {
    const items = await prisma.saleItem.findMany({
      where: { product: { supplierId }, sale: whereDate },
      select: {
        subtotal: true,
        sale: { select: { id: true, paymentMethod: true } }
      }
    });

    const groups = new Map<string, { total: number; saleIds: Set<string> }>();
    for (const item of items) {
      const method = item.sale.paymentMethod;
      if (!groups.has(method)) {
        groups.set(method, { total: 0, saleIds: new Set() });
      }
      const g = groups.get(method)!;
      g.total += item.subtotal;
      g.saleIds.add(item.sale.id);
    }

    salesByPayment = Array.from(groups.entries()).map(([method, g]) => ({
      method,
      count: g.saleIds.size,
      total: g.total
    }));
  } else {
    const grouped = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      _sum: { total: true },
      _count: true,
      where: whereDate
    });
    salesByPayment = grouped.map(p => ({
      method: p.paymentMethod,
      count: p._count,
      total: p._sum.total ?? 0
    }));
  }

  // ---------- Desglose diario ----------
  const supplierFilter = supplierId
    ? Prisma.sql`AND p."supplierId" = ${supplierId}`
    : Prisma.empty;

  const dailySales: Array<{ date: string; count: number; total: number; extra: number; comision: number }> = supplierId
    ? await prisma.$queryRaw`
        SELECT
          TO_CHAR((s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}), 'YYYY-MM-DD') as date,
          COUNT(DISTINCT s.id)::int as count,
          SUM(si.subtotal) as total,
          0 as extra,
          0 as comision
        FROM "Sale" s
        JOIN "SaleItem" si ON si."saleId" = s.id
        JOIN "Product" p ON p.id = si."productId"
        WHERE s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        ${supplierFilter}
        GROUP BY 1
        ORDER BY date ASC
      `
    : await prisma.$queryRaw`
        SELECT
          TO_CHAR((s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE}), 'YYYY-MM-DD') as date,
          COUNT(s.*)::int as count,
          SUM(s.total) as total,
          SUM(s.extra) as extra,
          SUM(s.comision) as comision
        FROM "Sale" s
        WHERE s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY 1
        ORDER BY date ASC
      `;

  // ---------- Resto de métricas (ya eran a nivel de item/producto, no requieren prorrateo) ----------
  const productsSoldAgg = await prisma.saleItem.count({
    where: {
      sale: whereDate,
      ...(supplierId ? { product: { supplierId } } : {})
    }
  });

  const lastSales = await prisma.sale.findMany({
    where: whereSale,
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      items: {
        where: supplierId ? { product: { supplierId } } : {},
        include: { product: { select: { name: true } } }
      }
    }
  });

  const topProductsRaw = await prisma.saleItem.groupBy({
    by: ["productId"],
    _sum: { quantity: true, subtotal: true },
    where: {
      sale: whereDate,
      ...(supplierId ? { product: { supplierId } } : {})
    },
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
    where: {
      stock: { lte: 5 },
      ...(supplierId ? { supplierId } : {})
    },
    orderBy: { stock: "asc" },
    take: 10,
    select: { id: true, name: true, stock: true, type: true }
  });

  const productsByType = await prisma.product.groupBy({
    by: ["type"],
    _count: true,
    where: supplierId ? { supplierId } : {}
  });

  const totalSuppliers = await prisma.supplier.count();
  const suppliersWithProducts = await prisma.supplier.count({
    where: { products: { some: {} } }
  });

  return responseSuccess(res, {
    sales: {
      total: salesTotal,
      count: salesCount,
      extra: salesExtra,
      average: salesCount > 0 ? salesTotal / salesCount : 0,
      totalProductsSold: productsSoldAgg ?? 0,
      lastSales: lastSales.map(s => ({
        id: s.id,
        total: s.total,
        extra: supplierId ? 0 : s.extra,
        paymentMethod: s.paymentMethod,
        createdAt: s.createdAt,
        items: s.items.map(i => ({
          productName: i.product.name,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal
        }))
      })),
      byPaymentMethod: salesByPayment,
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