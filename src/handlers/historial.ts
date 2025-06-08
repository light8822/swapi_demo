import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE = process.env.DYNAMO_COMM!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const movieId = event.pathParameters?.movieId;
    const qs = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(qs.page ?? '1', 10));
    const pageSize = 10;

    const resp = await docClient.send(new ScanCommand({
      TableName: TABLE
    }));
    let items = (resp.Items || []) as any[];

    if (movieId) {
      items = items.filter(i => i.movieId === movieId);
    }

    items.sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    const total  = items.length;
    const pages  = Math.ceil(total / pageSize);
    const start  = (page - 1) * pageSize;
    const slice  = items.slice(start, start + pageSize);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: movieId
          ? `Comentarios para película ${movieId}`
          : 'Todos los comentarios',
        page,
        pages,
        total,
        data: slice,
      }),
    };
  } catch (err: any) {
    console.error('Error en historial:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error al listar comentarios',
        error: err.message,
      }),
    };
  }
};
