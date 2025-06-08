// tests/services/movieService.spec.ts

import axios, { type AxiosResponse } from 'axios';
import type {
  CombinedFilm,
  RawSwapiResponse,
  RawSingleSwapiResponse,
  RawImdbResponse,
} from '../../src/types/apiResponse';

// 1) Mock estático de axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 2) Mock estático de DynamoDBClient (no usa sendMock)
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

// 3) Creamos aquí el mock para todas las llamadas docClient.send()
const sendMock = jest.fn();

// 4) Variables donde meteremos nuestras funciones tras el mock dinámico
let fetchAllFilmsData: () => Promise<CombinedFilm[]>;
let fetchSingleFilmData: (id: string) => Promise<CombinedFilm>;

beforeAll(async () => {
  // 5) Mock dinámico de lib-dynamodb, NO hoisteado
  jest.doMock('@aws-sdk/lib-dynamodb', () => {
    return {
      DynamoDBDocumentClient: {
        from: jest.fn().mockReturnValue({ send: sendMock }),
      },
      GetCommand: jest.fn().mockImplementation(params => ({ params })),
      PutCommand: jest.fn().mockImplementation(params => ({ params })),
    };
  });

  // 6) Configuramos las env vars ANTES de importar el servicio
  process.env.DYNAMO_TABLE   = 'TestTable';
  process.env.API_URL        = 'https://swapi.example.com/films';
  process.env.IMDB_API_BASE  = 'https://imdb.example.com';
  process.env.IMDB_HOST      = 'imdb.example.com';
  process.env.IMDB_KEY       = 'FAKE_KEY';

  // 7) Ahora que los mocks están listos, importamos el servicio
  const svc = await import('../../src/services/movieService');
  fetchAllFilmsData  = svc.fetchAllFilmsData;
  fetchSingleFilmData = svc.fetchSingleFilmData;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('filmService', () => {
  describe('fetchAllFilmsData', () => {
    it('devuelve cache si existe', async () => {
      const fakeCache: CombinedFilm[] = [{
        title: 'T1', episode: 1, director: 'D1',
        releaseDate: '2020-01-01', openingCrawl: '...',
        id: 'tt1', url: 'u1', primaryImage: 'img1', trailer: 'tr1',
      }];

      // Simulamos que getAllCache retorna cache
      sendMock.mockResolvedValueOnce({ Item: { data: fakeCache } });

      const result = await fetchAllFilmsData();

      expect(result).toEqual(fakeCache);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('si no hay cache, llama APIs, persiste y retorna', async () => {
      // 1) getAllCache → {}
      // 2) putAllCache → {}
      // 3+) putSingleCache → {}
      sendMock
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValue({});

      const swapiList = {
        result: [{
          properties: {
            title: 'T2', episode_id: 2,
            director: 'D2', release_date: '2021-02-02',
            opening_crawl: '...',
          },
        }],
      } as RawSwapiResponse;

      const rawImdb = {
        id: 'tt2', url: 'u2',
        primaryImage: 'img2', trailer: 'tr2',
      } as RawImdbResponse;

      mockedAxios.get
        .mockResolvedValueOnce({ data: swapiList } as AxiosResponse<RawSwapiResponse>)
        .mockResolvedValueOnce({ data: rawImdb }   as AxiosResponse<RawImdbResponse>);

      const result = await fetchAllFilmsData();

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      // Validamos que el primer GetCommand fuera con pk 'ALL'
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ Key: { pk: 'ALL' } }) })
      );
      // Y al menos un PutCommand
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ Item: expect.any(Object) }) })
      );

      expect(result).toEqual([{
        title: 'T2', episode: 2, director: 'D2',
        releaseDate: '2021-02-02', openingCrawl: '...',
        id: 'tt2', url: 'u2', primaryImage: 'img2', trailer: 'tr2',
      }]);
    });
  });

  describe('fetchSingleFilmData', () => {
    it('devuelve cache individual si existe', async () => {
      const fakeFilm: CombinedFilm = {
        title: 'T3', episode: 3, director: 'D3',
        releaseDate: '2022-03-03', openingCrawl: '...',
        id: 'tt3', url: 'u3', primaryImage: 'img3', trailer: 'tr3',
      };

      sendMock.mockResolvedValueOnce({ Item: { data: fakeFilm } });

      const result = await fetchSingleFilmData('3');

      expect(result).toEqual(fakeFilm);
      expect(sendMock).toHaveBeenCalled();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('si no hay cache, llama APIs, persiste y retorna', async () => {
      sendMock
        .mockResolvedValueOnce({})  // getSingleCache
        .mockResolvedValueOnce({}); // putSingleCache

      const swapiSingle = {
        result: {
          properties: {
            title: 'T4', episode_id: 4,
            director: 'D4', release_date: '2023-04-04',
            opening_crawl: '...',
          },
        },
      } as RawSingleSwapiResponse;

      const rawImdb = {
        id: 'tt4', url: 'u4',
        primaryImage: 'img4', trailer: 'tr4',
      } as RawImdbResponse;

      mockedAxios.get
        .mockResolvedValueOnce({ data: swapiSingle } as AxiosResponse<RawSingleSwapiResponse>)
        .mockResolvedValueOnce({ data: rawImdb }     as AxiosResponse<RawImdbResponse>);

      const result = await fetchSingleFilmData('4');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ Key: { pk: 'FILM#4' } }) })
      );
      expect(result).toEqual({
        title: 'T4', episode: 4, director: 'D4',
        releaseDate: '2023-04-04', openingCrawl: '...',
        id: 'tt4', url: 'u4', primaryImage: 'img4', trailer: 'tr4',
      });
    });
  });
});
