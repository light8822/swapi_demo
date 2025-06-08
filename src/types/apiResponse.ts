export interface RawSwapiResponse {
    message: string;
    result: RawFilm[];
}

export interface RawApiResponse {
    message: string;
    result: RawFilm[];
}

export interface RawFilm {
    uid: string;
    properties: {
        title: string;
        episode_id: number;
        director: string;
        producer: string;
        release_date: string;
        opening_crawl: string;
    };
}

export interface FilmSummary {
  title:       string;
  episode:     number;
  director:    string;
  releaseDate: string;
  openingCrawl: string;
}

export interface RawImdbResponse {
  id:           string;
  url:          string;
  primaryImage: string;
  trailer:      string;
}
export interface ImdbSummary {
  id:           string;
  url:          string;
  primaryImage: string;
  trailer:      string;
}

export interface RawSingleSwapiResponse {
  message: string;
  result: RawFilm;
}

export interface CombinedFilm extends FilmSummary, ImdbSummary {}