import { generateUUID, getStored, setStored } from './storage-helpers';

// ---------------------------------------------------------------------------
// PÓS-PELADA E VOTAÇÃO DE NOTAS
// ---------------------------------------------------------------------------
export const RatingService = {
  submitRatings(
    matchId: string, 
    raterUserId: string, 
    ratings: Array<{ ratedUserId: string; rating: number; tag?: string }>
  ): void {
    const existingRatings = getStored<any[]>(`ratings_${matchId}`, []);
    ratings.forEach((item) => {
      existingRatings.push({
        id: generateUUID(),
        matchId,
        raterUserId,
        ratedUserId: item.ratedUserId,
        rating: item.rating,
        tag: item.tag,
        createdAt: new Date().toISOString(),
      });
    });
    setStored(`ratings_${matchId}`, existingRatings);
  }
};
