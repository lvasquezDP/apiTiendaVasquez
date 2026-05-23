import { Router } from "express";
import reportRouter from "./router/report.routes";
import saleRouter from "./router/sale.routes";
import productRouter from "./router/product.routes";
import supplierRouter from "./router/supplier.routes";

export class AppRoutes {
  static get routes(): Router {
    const router = Router();

    router.use("/product", productRouter);
    router.use("/sale", saleRouter);
    router.use("/report", reportRouter);
    router.use("/supplier", supplierRouter);

    return router;
  }
}