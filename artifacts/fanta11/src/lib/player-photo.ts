const PREMIER_LEAGUE_PHOTO_BASE =
  "https://resources.premierleague.com/premierleague25/photos/players/500x500";

export function getPremierLeaguePhotoUrl(imageUrl?: string | null): string | null {
  const code = imageUrl?.match(/\/p(\d+)\.png(?:[?#]|$)/i)?.[1];
  return code ? `${PREMIER_LEAGUE_PHOTO_BASE}/${code}.png` : null;
}