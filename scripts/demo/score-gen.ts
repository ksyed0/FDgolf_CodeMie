export function generateScore(par: number): number {
  return par + Math.floor(Math.random() * 5); // par+0 to par+4
}
