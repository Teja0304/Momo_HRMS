declare module 'pino-http' {
  import type { RequestHandler } from 'express';
  import type { Logger } from 'pino';

  interface Options {
    logger?: Logger;
    genReqId?: (req: any, res: any) => string;
    serializers?: {
      req?: (req: any) => any;
      res?: (res: any) => any;
      err?: (err: any) => any;
    };
    customLogLevel?: (req: any, res: any, err: any) => string;
  }

  function pinoHttp(opts?: Options): RequestHandler;
  export default pinoHttp;
}
