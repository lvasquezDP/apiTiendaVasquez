import express, { NextFunction, Request, Response, Router } from "express";
import path from "path";
import cors from "cors";
import fileUpload from "express-fileupload";

export class Server {
    public readonly app = express();
    private serverListener?: any;

    constructor(
        private readonly port: number,
        private readonly public_path: string = "public"
    ) {
        this.configure();
    }

    private configure() {
        //* Middlewares
        this.app.use(cors({
            origin: "*",
        }));
        this.app.use(express.json()); // raw
        this.app.use(fileUpload({ defParamCharset: "utf-8" })); // multipart/form-data
        this.app.use(express.urlencoded({ extended: true })); // x-www-form-urlencoded

        //* Public Folder
        this.app.use(express.static(this.public_path));

        this.app.use((req: Request, res: Response, next: NextFunction) => {
            console.table({ [req.method]: req.url });
            return next();
        });
        
        this.app.get(/^\/(uploads).*/, (req, res) => {
            if (req.originalUrl.match("uploads"))
                res.sendFile(path.join(__dirname, "../", req.originalUrl));
            else res.json({ message: "Archivo no encontrado" });
        });
    }

    async start() {
        this.serverListener = this.app.listen(this.port, "0.0.0.0", () => {
            console.log(`Express: Server running on port ${this.port}`);
        });
    }

    public setRoutes(router: Router) {
        this.app.use(router);
    }

    public close() {
        this.serverListener?.close();
    }
}