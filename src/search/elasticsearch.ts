import { ConflictError, DependencyError, ErrorCode, ISearchResult, ISearchOptions } from '@hiep20012003/joblance-shared';
import { AppLogger } from '@gigs/utils/logger';
import { Client, estypes } from '@elastic/elasticsearch';
import { config } from '@gigs/config';
import { QueryDslQueryContainer } from "@elastic/elasticsearch/lib/api/types";

export class Elasticsearch {
  private elasticSearchClient: Client;

  constructor(url: string) {
    this.elasticSearchClient = new Client({
      node: url,
      tls: {
        rejectUnauthorized: false // dev/test only
      }
    });
  }

  search = async <T>(index: string, options: ISearchOptions): Promise<ISearchResult<T>> => {
    try {
      const result: estypes.SearchResponse<T> = await this.elasticSearchClient.search<T>({
        index,
        query: options.query,
        from: options.from,
        size: options.size,
        sort: options.sort,
        _source: options._source,
        aggs: options.aggs,
        highlight: options.highlight,
        track_total_hits: options.track_total_hits ?? true,
        search_after: options.search_after
      });

      const hits = result.hits.hits;
      const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0);

      return {
        hits,
        total,
        aggs: result.aggregations,
        highlights: result.hits.hits.map((hit) => hit.highlight ?? {})
      };
    } catch (error) {
      AppLogger.error(`Unexpected ES error while searching in index "${index}"`, {
        operation: 'elasticsearch:search',
        error,
        context: { index, options }
      });
      return { hits: [], total: 0 };
    }
  };

  checkConnection = async (): Promise<void> => {
    let isConnected = false;
    while (!isConnected) {
      try {
        const health: estypes.ClusterHealthHealthResponseBody = await this.elasticSearchClient.cluster.health({});
        AppLogger.info(`Gig Service Elasticsearch cluster status - ${health.status}`, {
          operation: 'elasticsearch:check-connection'
        });
        isConnected = true;
      } catch (error) {
        AppLogger.error('Failed to connect to Elasticsearch cluster. Retrying...', {
          operation: 'elasticsearch:check-connection-error',
          error
        });
      }
    }
  };

  checkIndexExists = async (index: string): Promise<boolean> => {
    return await this.elasticSearchClient.indices.exists({ index });
  };

  createIndex = async (index: string): Promise<void> => {
    try {
      const existingIndex = await this.checkIndexExists(index);

      if (existingIndex) {
        // AppLogger.warn(`Index "${index}" already exists`, {
        //     operation: 'elasticsearch:createIndex',
        // });
        throw new ConflictError({
          logMessage: `Index "${index}" already exists`,
          operation: 'elasticsearch:create-index',
          errorCode: ErrorCode.RESOURCE_CONFLICT,
          context: { index }
        });
      }

      await this.elasticSearchClient.indices.create({ index });
      await this.elasticSearchClient.indices.refresh({ index });
    } catch (error) {
      AppLogger.warn('Unexpected ES error while creating index "${index}', {
        operation: 'elasticsearch:create-index',
        error
      });
      // throw new DependencyError({
      //     logMessage: `Unexpected ES error while creating index "${index}"`,
      //     operation: 'elasticsearch:create-index',
      //     errorCode: ErrorCode.DEPENDENCY_ERROR,
      //     cause: error,
      //     context: {index}
      // });
    }
  };

  getDocumentCount = async (index: string): Promise<estypes.CountResponse | null> => {
    try {
      const result: estypes.CountResponse = await this.elasticSearchClient.count({ index });
      return result;
    } catch (error) {
      AppLogger.error(`Unexpected ES error while getting document count of "${index}"`, {
        operation: 'elasticsearch:get-document-count',
        error
      });
      return null;
    }
  };

  getIndexedData = async <T>(index: string, itemId: string): Promise<estypes.GetResponse<T> | null> => {
    try {
      const result = await this.elasticSearchClient.get<T>({ index, id: itemId });
      return result;
    } catch (error) {
      AppLogger.error(`Unexpected ES error while getting data  of "${index}"`, {
        operation: 'elasticsearch:get-indexed-data',
        error
      });
      return null;
    }
  };

  addDataToIndex = async (index: string, itemId: string, gigDocument: unknown): Promise<void> => {
    try {
      await this.elasticSearchClient.index({
        index,
        id: itemId,
        document: gigDocument
      });
      await this.elasticSearchClient.indices.refresh({ index });
    } catch (error) {
      throw new DependencyError({
        logMessage: `Unexpected ES error while adding data to index "${index}"`,
        operation: 'elasticsearch:add-data-to-index',
        errorCode: ErrorCode.DEPENDENCY_ERROR,
        cause: error,
        context: { index, itemId }
      });
    }
  };

  addManyDocsToIndex = async (index: string, batch: any[]): Promise<void> => {
    try {
      const operations = batch.flatMap(doc => [
        { index: { _index: index, _id: doc.id } },
        doc
      ]);
      await this.elasticSearchClient.bulk({
        operations: operations
      });
    } catch (error) {
      throw new DependencyError({
        logMessage: `Unexpected ES error while adding data to index "${index}"`,
        operation: 'elasticsearch:add-data-to-index',
        errorCode: ErrorCode.DEPENDENCY_ERROR,
        cause: error,
        context: { index }
      });
    }
  };

  updateIndexedData = async (index: string, itemId: string, gigDocument: unknown): Promise<void> => {
    try {
      await this.elasticSearchClient.update({
        index,
        id: itemId,
        doc: gigDocument
      });
      await this.elasticSearchClient.indices.refresh({ index });
    } catch (error) {
      throw new DependencyError({
        logMessage: `Unexpected ES error while updating data in index "${index}"`,
        operation: 'elasticsearch:update-indexed-data',
        errorCode: ErrorCode.DEPENDENCY_ERROR,
        cause: error,
        context: { index, itemId }
      });
    }
  };

  deleteIndexedData = async (index: string, itemId: string): Promise<void> => {
    try {
      const response: estypes.DeleteResponse = await this.elasticSearchClient.delete({
        index,
        id: itemId
      });

      if (response.result !== 'deleted') {
        throw new Error(`Document with ID "${itemId}" was not deleted from index "${index}"`);
      }

      AppLogger.info('Document deleted from Elasticsearch', {
        operation: 'elasticsearch:delete-document',
        context: { index, itemId }
      });

      await this.elasticSearchClient.indices.refresh({ index });

    } catch (error) {
      throw new DependencyError({
        logMessage: `Unexpected ES error while deleting data from index "${index}"`,
        operation: 'elasticsearch:delete-indexed-data',
        errorCode: ErrorCode.DEPENDENCY_ERROR,
        cause: error,
        context: { index, itemId }
      });
    }
  };

  deleteByQuery = async (index: string, query: QueryDslQueryContainer): Promise<void> => {
    try {
      await this.elasticSearchClient.deleteByQuery({
        index,
        query
      });

      AppLogger.info('Documents deleted from Elasticsearch', {
        operation: 'elasticsearch:delete-documents',
        context: { index }
      });

      await this.elasticSearchClient.indices.refresh({ index });

    } catch (error) {
      throw new DependencyError({
        logMessage: `Unexpected ES error while deleting data from index "${index}"`,
        operation: 'elasticsearch:delete-indexed-data',
        errorCode: ErrorCode.DEPENDENCY_ERROR,
        cause: error,
        context: { index }
      });
    }
  };

}

export const elasticsearch: Elasticsearch = new Elasticsearch(`${config.ELASTIC_SEARCH_URL}`);
