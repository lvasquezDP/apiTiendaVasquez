import express from "express";
import cors from "cors";
import productRouter from "./router/product.routes";
import saleRouter from "./router/sale.routes";
import reportRouter from "./router/report.routes";

const app = express();
app.use(cors({
  origin: "*",
}));
app.use(express.json());
app.use("/product", productRouter);
app.use("/sale", saleRouter);
app.use("/report", reportRouter);

app.listen(3000, "0.0.0.0", () => {
  console.log("Servidor corriendo en red");
});