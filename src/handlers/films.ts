import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  fetchAllFilmsData,
  fetchSingleFilmData
} from '../services/movieService';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (id) {
      const film = await fetchSingleFilmData(id);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Película obtenida', data: film })
      };
    } else {
      const all = await fetchAllFilmsData();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Todas las películas', data: all })
      };
    }
  } catch (err: any) {
    console.error(err);
    return {
      statusCode: err.response?.status ?? 500,
      body: JSON.stringify({ message: 'Error', error: err.message })
    };
  }
};
