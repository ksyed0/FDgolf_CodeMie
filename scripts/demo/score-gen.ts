export function generateScore(par: number): number {
  // Weighted distribution realistic for best-ball corporate golf:
  // Eagle 3% / Birdie 25% / Par 52% / Bogey 17% / Double 3%
  const r = Math.random();
  let vspar: number;
  if (r < 0.03) vspar = -2;
  else if (r < 0.28) vspar = -1;
  else if (r < 0.80) vspar = 0;
  else if (r < 0.97) vspar = 1;
  else vspar = 2;
  return Math.max(1, par + vspar);
}
