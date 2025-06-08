import axios from 'axios';
import {
  RawSwapiResponse,
  RawSingleSwapiResponse,
  FilmSummary,
  RawImdbResponse,
  ImdbSummary,
  CombinedFilm
} from '../types/apiResponse';

import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from '@aws-sdk/lib-dynamodb';

const EPISODE_TO_IMDB: Record<number,string> = {
  1: 'tt0120915',
  2: 'tt0121765',
  3: 'tt0121766',
  4: 'tt0076759',
  5: 'tt0080684',
  6: 'tt0086190',
};

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE = process.env.DYNAMO_TABLE!;

async function getAllCache(): Promise<CombinedFilm[]|null> {
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: 'ALL' }
  }));
  return resp.Item?.data as CombinedFilm[] || null;
}

async function putAllCache(items: CombinedFilm[]) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: 'ALL', data: items, updatedAt: new Date().toISOString() }
  }));
}

async function getSingleCache(episode: number): Promise<CombinedFilm|null> {
  const resp = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: `FILM#${episode}` }
  }));
  return resp.Item?.data as CombinedFilm || null;
}

async function putSingleCache(film: CombinedFilm) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: `FILM#${film.episode}`, data: film, updatedAt: new Date().toISOString() }
  }));
}

async function fetchSwapiList(): Promise<RawSwapiResponse> {
  return (await axios.get<RawSwapiResponse>(process.env.API_URL!)).data;
}

async function fetchSwapiSingle(id: string): Promise<RawSingleSwapiResponse> {
  return (await axios.get<RawSingleSwapiResponse>(`${process.env.API_URL}/${id}`)).data;
}

async function fetchImdbData(imdbId: string): Promise<ImdbSummary> {
  const base = process.env.IMDB_API_BASE!;
  const host = process.env.IMDB_HOST!;
  const key  = process.env.IMDB_KEY!;
  const { data } = await axios.get<RawImdbResponse>(
    `${base}/${imdbId}`, {
      headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': key }
    }
  );
  return {
    id: data.id,
    url: data.url,
    primaryImage: data.primaryImage,
    trailer: data.trailer,
  };
}


export async function fetchAllFilmsData(): Promise<CombinedFilm[]> {
  const cache = await getAllCache();
  if (cache) {
    console.log('usando cache ALL');
    return cache;
  }

  const rawList = await fetchSwapiList();
  const results: CombinedFilm[] = [];

  for (const item of rawList.result) {
    const props = item.properties;
    const film: FilmSummary = {
      title: props.title,
      episode: props.episode_id,
      director: props.director,
      releaseDate: props.release_date,
      openingCrawl: props.opening_crawl,
    };

    const imdb = await fetchImdbData(EPISODE_TO_IMDB[film.episode]);
    results.push({ ...film, ...imdb });
    await new Promise(r => setTimeout(r, 200));
  }

  await putAllCache(results);
  for (const f of results) {
    await putSingleCache(f);
  }

  return results;
}

export async function fetchSingleFilmData(id: string): Promise<CombinedFilm> {
  const ep = parseInt(id, 10);

  const singleCache = await getSingleCache(ep);
  if (singleCache) {
    console.log(`usando cache FILM#${ep}`);
    return singleCache;
  }

  const raw = await fetchSwapiSingle(id);
  const p = raw.result.properties;
  const film: FilmSummary = {
    title: p.title,
    episode: p.episode_id,
    director: p.director,
    releaseDate: p.release_date,
    openingCrawl: p.opening_crawl,
  };

  const imdb = await fetchImdbData(EPISODE_TO_IMDB[film.episode]);
  const combined = { ...film, ...imdb };

  await putSingleCache(combined);

  return combined;
}
