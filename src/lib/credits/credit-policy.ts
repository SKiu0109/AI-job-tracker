export function shouldAutoMigrateGuestCreditsToUser() {
  return false;
}

export function shouldFetchCreditsStatus(isAuthLoading: boolean) {
  return !isAuthLoading;
}
