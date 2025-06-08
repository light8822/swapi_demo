import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE = process.env.DYNAMO_COMM!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const movieId = event.pathParameters?.id;
  if (!movieId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Falta el ID de la película' }),
    };
  }

  let body: any;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Body JSON inválido' }),
    };
  }

  const comentario: string = body.comentario;
  if (!comentario) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Se requiere el campo comentario' }),
    };
  }

  const fecha = new Date().toISOString();
  const id = randomUUID();

  const item = {
    id,
    movieId,
    comentario,
    fecha,
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: item,
    }));

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Comentario almacenado',
        data: item,
      }),
    };
  } catch (err: any) {
    console.error('Error DynamoDB:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error al guardar comentario',
        error: err.message,
      }),
    };
  }
};
