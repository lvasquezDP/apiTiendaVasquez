import { UploadedFile } from "express-fileupload";
import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string(),

  photo: z
    .custom<UploadedFile>()
    .optional()
    .refine((file) => !Array.isArray(file), {
      message: "Solo se permite un archivo, no múltiples.",
    }),
});