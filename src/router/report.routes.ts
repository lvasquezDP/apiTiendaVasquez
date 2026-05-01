import { Router } from "express";
import prisma from "../data";
import { responseSuccess } from "../utils/response";

const reportRouter = Router();

reportRouter.get("/", async (_req, res) => {
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

export default reportRouter;