import { NextFunction, Request, Response } from "express";

export const validatorFiles = (req: Request,res: Response,next: NextFunction) => {
  try {
    if (!req.files || Object.keys(req.files).length == 0) return next();
  
    req.body={...req.body,...req.files};
    
    return next();
  } catch (errors) {
    return res.status(401).json({ errors }), undefined;
  }
};
