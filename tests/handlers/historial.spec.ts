// tests/handlers/historial.spec.ts

// 1) Hoist mock de lib-dynamodb ANTES de cualquier import estático
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

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
    APIGatewayProxyResultV2,
    Context,
    Callback
} from 'aws-lambda';

describe('handler de historial de comentarios', () => {

    let handler: (
        event: APIGatewayProxyEventV2,
        context: Context,
        callback: Callback<APIGatewayProxyResultV2>
    ) => Promise<APIGatewayProxyStructuredResultV2>;

    const sendMock = jest.fn();
    const stubContext = {} as Context;
    const stubCallback: Callback<APIGatewayProxyResultV2> = jest.fn();

    beforeEach(() => {
        sendMock.mockReset();
        (stubCallback as jest.Mock).mockReset();
        // 2) Ahora sí mockeamos .from() ¡antes de importar!
        (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({ send: sendMock });

        jest.isolateModules(() => {
            const mod = require('../../src/handlers/historial');
            handler = mod.handler;
        });
    });

    const sampleItems = [
        { movieId: '1', fecha: '2025-06-07T00:00:00Z', comment: 'A' },
        { movieId: '2', fecha: '2025-06-06T00:00:00Z', comment: 'B' },
        { movieId: '1', fecha: '2025-06-05T00:00:00Z', comment: 'C' },
    ];

    it('→ devuelve todos los comentarios ordenados y paginados (pág.1)', async () => {
        sendMock.mockResolvedValue({ Items: sampleItems });

        const event = {
            pathParameters: {},
            queryStringParameters: {},
        } as unknown as APIGatewayProxyEventV2;

        const raw = await handler(event, stubContext, stubCallback);
        const res = raw as APIGatewayProxyStructuredResultV2;

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body!);
        expect(body.data.map((i: any) => i.comment)).toEqual(['C', 'B', 'A']);
        expect(body.page).toBe(1);
        expect(body.pages).toBe(1);
        expect(body.total).toBe(3);
        expect(body.message).toBe('Todos los comentarios');
    });

    it('→ filtra por movieId y retorna sólo esos comentarios', async () => {
        sendMock.mockResolvedValue({ Items: sampleItems });

        const event = {
            pathParameters: { movieId: '1' },
            queryStringParameters: {},
        } as unknown as APIGatewayProxyEventV2;

        const raw = await handler(event, stubContext, stubCallback);
        const res = raw as APIGatewayProxyStructuredResultV2;
        const body = JSON.parse(res.body!);

        expect(body.data.map((i: any) => i.comment)).toEqual(['C', 'A']);
        expect(body.total).toBe(2);
        expect(body.pages).toBe(1);
        expect(body.message).toBe('Comentarios para película 1');
    });

    it('→ paginación: 15 items → pág.2 con 5 resultados', async () => {
        const items15 = Array.from({ length: 15 }, (_, i) => ({
            movieId: 'x',
            fecha: `2025-06-${30 - i}T00:00:00Z`,
            idx: i + 1,
        }));
        sendMock.mockResolvedValue({ Items: items15 });

        const event = {
            pathParameters: {},
            queryStringParameters: { page: '2' },
        } as unknown as APIGatewayProxyEventV2;

        const raw = await handler(event, stubContext, stubCallback);
        const res = raw as APIGatewayProxyStructuredResultV2;
        const body = JSON.parse(res.body!);

        expect(body.data).toHaveLength(5);
        expect(body.total).toBe(15);
        expect(body.pages).toBe(2);
        expect(body.page).toBe(2);
    });

    it('→ si Dynamo falla devuelve 500 con el mensaje de error', async () => {
        sendMock.mockRejectedValue(new Error('fail'));

        const event = {
            pathParameters: {},
            queryStringParameters: {},
        } as unknown as APIGatewayProxyEventV2;

        const raw = await handler(event, stubContext, stubCallback);
        const res = raw as APIGatewayProxyStructuredResultV2;

        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body!);
        expect(body.message).toBe('Error al listar comentarios');
        expect(body.error).toBe('fail');
    });
});
