jest.mock('../../src/services/movieService', () => ({
  fetchAllFilmsData: jest.fn(),
  fetchSingleFilmData: jest.fn(),
}));

import { handler } from '../../src/handlers/films';
import * as movieService from '../../src/services/movieService';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  APIGatewayProxyResultV2,
  Context,
  Callback
} from 'aws-lambda';
import type { CombinedFilm } from '../../src/types/apiResponse';

const mockedService = movieService as jest.Mocked<typeof movieService>;
const stubContext = {} as Context;
const stubCallback: Callback<APIGatewayProxyResultV2> = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handler de films.ts', () => {
  // Fixtures que cumplen CombinedFilm
  const film1: CombinedFilm = {
    title: 'A New Hope',
    episode: 4,
    director: 'George Lucas',
    releaseDate: '1977-05-25',
    openingCrawl: 'It is a period of civil war…',
    id: 'tt0076759',
    url: 'https://imdb.com/title/tt0076759',
    primaryImage: 'https://image.tmdb.org/…/A.jpg',
    trailer: 'https://youtube.com/…',
  };
  const film2: CombinedFilm = {
    title: 'The Empire Strikes Back',
    episode: 5,
    director: 'Irvin Kershner',
    releaseDate: '1980-05-21',
    openingCrawl: 'It is a dark time for the Rebellion…',
    id: 'tt0080684',
    url: 'https://imdb.com/title/tt0080684',
    primaryImage: 'https://image.tmdb.org/…/B.jpg',
    trailer: 'https://youtube.com/…',
  };

  it('→ sin id llama a fetchAllFilmsData y devuelve todas las películas', async () => {
    mockedService.fetchAllFilmsData.mockResolvedValue([film1, film2]);

    const event = {
      pathParameters: {},  // nada
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(mockedService.fetchAllFilmsData).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Todas las películas');
    expect(body.data).toEqual([film1, film2]);
  });

  it('→ con id llama a fetchSingleFilmData y devuelve esa película', async () => {
    mockedService.fetchSingleFilmData.mockResolvedValue(film2);

    const event = {
      pathParameters: { id: 'tt0080684' },
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(mockedService.fetchSingleFilmData).toHaveBeenCalledWith('tt0080684');
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Película obtenida');
    expect(body.data).toEqual(film2);
  });

  it('→ si fetchSingleFilmData rechaza con response.status, usa ese código', async () => {
    const err: any = new Error('not found');
    err.response = { status: 404 };
    mockedService.fetchSingleFilmData.mockRejectedValue(err);

    const event = {
      pathParameters: { id: 'no-existe' },
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Error');
    expect(body.error).toBe('not found');
  });

  it('→ si fetchAllFilmsData falla sin response.status, devuelve 500', async () => {
    mockedService.fetchAllFilmsData.mockRejectedValue(new Error('boom'));

    const event = {
      pathParameters: {},
    } as unknown as APIGatewayProxyEventV2;

    const raw = await handler(event, stubContext, stubCallback);
    const res = raw as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body!);
    expect(body.message).toBe('Error');
    expect(body.error).toBe('boom');
  });
});
