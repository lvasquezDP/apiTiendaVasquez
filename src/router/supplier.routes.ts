import { Router } from "express";
import { supplierSchema } from "../schemas/supplier.schema";
import prisma from "../data";
import { responseError, responseSuccess } from "../utils/response";
import { validatorFiles } from "../utils/files.middleware";
import { UploadedFile } from "express-fileupload";

import fs from "fs";
import * as pathh from "path";

const supplierRouter = Router();

supplierRouter.get("/search", async (req, res) => {
  const { name } = req.query;

  try {
    const suppliers = await prisma.supplier.findMany({
      where: (name
        ? {
          name: {
            contains: String(name),
            mode: "insensitive",
          },
        }
        : {}),
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return responseSuccess(res, suppliers, "SUPPLIERS_FETCHED");
  } catch (error: any) {
    return responseError(res, 500, error.message || "INTERNAL_SERVER_ERROR");
  }
});

supplierRouter.get("/find/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { products: true },
    });

    if (!supplier) {
      return responseError(res, 404, "SUPPLIER_NOT_FOUND");
    }

    return responseSuccess(res, supplier, "SUPPLIER_FETCHED");
  } catch (error: any) {
    return responseError(res, 500, error.message || "INTERNAL_SERVER_ERROR");
  }
});

supplierRouter.post("", validatorFiles, async (req, res) => {
  const payload = { ...req.body, photo: req.files?.photo };
  const result = supplierSchema.safeParse(payload);

  if (!result.success) return res.status(400).json(result.error);
  const { name } = result.data;

  try {
    const newSupplier = await prisma.supplier.create({
      data: {
        name,
      },
    });
    if (req.files?.photo) {
      const photoUrl = await uploadSingle(req.files?.photo as UploadedFile, "", `photo_${newSupplier.id}.jpg`);
      if (photoUrl)
        await prisma.supplier.update({
          where: { id: newSupplier.id },
          data: { photo: photoUrl },
        });
      newSupplier.photo = photoUrl;
    }
    return responseSuccess(res, newSupplier, "SUPPLIER_CREATED");
  } catch (error: any) {
    return responseError(res, 400, error.message || "COULD_NOT_CREATE_SUPPLIER");
  }
});

supplierRouter.put("/:id", validatorFiles, async (req, res) => {
  const { id } = req.params as { id: string };

  const result = supplierSchema.partial().safeParse({ ...req.body, photo: req.files?.photo });

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  try {
    const exists = await prisma.supplier.findUnique({ where: { id } });
    if (!exists) return responseError(res, 404, "SUPPLIER_NOT_FOUND");

    const { name = "" } = result.data;

    if (req.files?.photo) {
      const photoUrl = await uploadSingle(req.files?.photo as UploadedFile, "", `photo_${exists.id}.jpg`);
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
      },
    });

    return responseSuccess(res, updatedSupplier, "SUPPLIER_UPDATED");
  } catch (error: any) {
    return responseError(res, 400, error.message || "COULD_NOT_UPDATE_SUPPLIER");
  }
});

// supplierRouter.delete("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const exists = await prisma.supplier.findUnique({ where: { id } });
//     if (!exists) return responseError(res, 404, "SUPPLIER_NOT_FOUND");
//     await prisma.supplier.delete({
//       where: { id },
//     });
//     return responseSuccess(res, null, "SUPPLIER_DELETED");
//   } catch (error: any) {
//     return responseError(res, 400, error.message || "COULD_NOT_DELETE_SUPPLIER");
//   }
// });

function checkFolder(path: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

function uploadSingle(file: UploadedFile, path: string, fileName?: string) {
  try {
    const des = pathh.resolve(__dirname, "../../uploads/", path);
    checkFolder(des);
    file.mv(`${des}/${fileName}`);
    return path + fileName;
  } catch (error) {
    return null;
  }
}
export default supplierRouter;