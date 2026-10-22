/** Keep following content growth until the user scrolls away from the end. */
export function shouldFollowScroll(
  wasFollowing: boolean,
  previousTop: number,
  nextTop: number,
  distanceFromBottom: number,
): boolean {
  if (distanceFromBottom <= 100) return true;
  if (nextTop < previousTop) return false;
  return wasFollowing;
}
