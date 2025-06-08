jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('fixed-uuid'),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const original = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...original,                                
    DynamoDBDocumentClient: {
      ...original.DynamoDBDocumentClient,         
      from: jest.fn(),
    },
  };
});

import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyResultV2,
  Context,
  Callback
} from 'aws-lambda';

describe('handler de comments.ts', () => {
  let handler: (
    event: APIGatewayProxyEventV2,
    context: Context,
    callback: Callback<APIGatewayProxyResultV2>
  ) => Promise<APIGatewayProxyStructuredResultV2>;

  const sendMock = jest.fn();
  const stubContext = {} as Context;
  const stubCallback: Callback<APIGatewayProxyResultV2> = jest.fn();

  beforeEach(() => {
    process.env.DYNAMO_COMM = 'TestTable';

    sendMock.mockReset();
    (stubCallback as jest.Mock).mockReset();

    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({ send: sendMock });

    jest.isolateModules(() => {
      const mod = require('../../src/handlers/comments');
      handler = mod.handler;
    });
  });

  it('400 si no viene el ID de película', async () => {
    const event = {} as unknown as APIGatewayProxyEventV2;
    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Falta el ID de la película');
  });

  it('400 si el body no es JSON válido', async () => {
    const event = {
      pathParameters: { id: 'm1' },
      body: 'no-json',
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Body JSON inválido');
  });

  it('400 si falta el campo `comentario`', async () => {
    const event = {
      pathParameters: { id: 'm1' },
      body: JSON.stringify({ otra: 'cosa' }),
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Se requiere el campo comentario');
  });

  it('201 y guarda correctamente el comentario', async () => {
    sendMock.mockResolvedValue({});

    const event = {
      pathParameters: { id: 'movie-123' },
      body: JSON.stringify({ comentario: '¡Hola mundo!' }),
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body!);

    expect(body.message).toBe('Comentario almacenado');
    expect(body.data).toEqual({
      id: 'fixed-uuid',
      movieId: 'movie-123',
      comentario: '¡Hola mundo!',
      fecha: expect.any(String),
    });

    const putCmd = sendMock.mock.calls[0][0];
    expect(putCmd).toBeInstanceOf(PutCommand);
    expect(putCmd.input).toEqual({
      TableName: 'TestTable',
      Item: body.data,
    });
  });

  it('500 si falla el `put` en DynamoDB', async () => {
    sendMock.mockRejectedValue(new Error('falló Dynamo'));

    const event = {
      pathParameters: { id: 'movie-123' },
      body: JSON.stringify({ comentario: '¡Algo!' }),
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Error al guardar comentario');
    expect(body.error).toBe('falló Dynamo');
  });
});
