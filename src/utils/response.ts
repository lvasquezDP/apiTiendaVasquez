type ApiResponse<T> = {
  code: number;
  message: string;
  data: T | null;
  meta?: any;
};

export const responseSuccess = <T>(
  res: any,
  data: T,
  message = "OK",
  meta: any = {}
) => {
  return res.status(200).json({
    code: 200,
    message,
    data,
    meta
  } as ApiResponse<T>);
};

export const responseError = (
  res: any,
  code = 500,
  message = "INTERNAL_SERVER_ERROR",
  meta: any = null
) => {
  return res.status(code).json({
    code,
    message,
    data: null,
    meta: meta
  });
};