import http from 'http';

import { AppLogger } from '@gigs/utils/logger';
import { Application, json, NextFunction, urlencoded, Request, Response } from 'express';
import {
  ApplicationError,
  DependencyError,
  ErrorResponse,
  NotFoundError,
  ResponseOptions,
  ServerError
} from '@hiep20012003/joblance-shared';
import hpp from 'hpp';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { config } from '@gigs/config';
import { appRoutes } from '@gigs/routes';
import { initQueue } from '@gigs/queues/connection';
import { elasticsearch } from '@gigs/search/elasticsearch';
// import { database } from '@gig/database/connection';

const SERVER_PORT = config.PORT || 4004;

export class GigServer {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async start(): Promise<void> {
    // await database.connect();
    await this.startQueues();
    await this.startElasticsearch();
    this.startRedis();
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routesMiddleware(this.app);
    this.errorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application): void {
    app.set('trust proxy', 1);
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: config.API_GATEWAY_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      })
    );
  }

  private standardMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: '200mb' }));
    app.use(urlencoded({ extended: true, limit: '200mb' }));
  }

  private routesMiddleware(app: Application): void {
    appRoutes(app);
  }

  private async startQueues(): Promise<void> {
    await initQueue();
  }

  private startRedis() {
    // cacheStore.connect();
  }

  private async startElasticsearch() {
    await elasticsearch.checkConnection();
    await elasticsearch.createIndex('gigs');
  };

  private errorHandler(app: Application): void {
    app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
      const operation = 'server:handle-error';

      AppLogger.error(
        `API ${req.originalUrl} unexpected error`,
        {
          operation,
          error: err instanceof ApplicationError ? err.serialize() : {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          }
        }
      );

      if (err instanceof ApplicationError) {
        new ErrorResponse({
          ...err.serializeForClient() as ResponseOptions,

        }).send(res, true);
      } else {
        const serverError = new ServerError({
          clientMessage: 'Internal server error',
          cause: err,
          operation
        });
        new ErrorResponse({
          ...serverError.serializeForClient() as ResponseOptions
        }).send(res, true);
      }
    });

    app.use('/*splat', (req: Request, res: Response, _next: NextFunction) => {
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const operation = 'server:route-not-found';

      const err = new NotFoundError({
        clientMessage: `Endpoint not found: ${fullUrl}`,
        operation
      });

      AppLogger.error(
        `API ${req.originalUrl} route not found`,
        {
          operation,
          error: err instanceof ApplicationError ? err.serialize() : {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          }
        }
      );
      new ErrorResponse({
        ...err.serializeForClient() as ResponseOptions
      }).send(res, true);
    });
  }

  private startServer(app: Application): void {
    try {
      const httpServer: http.Server = new http.Server(app);
      this.startHttpServer(httpServer);
    } catch (error) {
      throw new ServerError({
        clientMessage: 'Failed to start Gig Service server',
        cause: error,
        operation: 'server:error'
      });
    }
  }

  private startHttpServer(httpServer: http.Server): void {
    try {
      AppLogger.info(`Gig server started with process id ${process.pid}`, { operation: 'server:http-start' });

      httpServer.listen(SERVER_PORT, () => {
        AppLogger.info(`Gig server is running on port ${SERVER_PORT}`, { operation: 'server:http-listening' });
      });
    } catch (error) {
      throw new DependencyError({
        clientMessage: 'Failed to bind HTTP port',
        cause: error,
        operation: 'server:bind-error'
      });
    }
  }
}