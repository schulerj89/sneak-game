type NavigatorLike = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>;

export function shouldUseMobileMemorySafeAssets(navigatorLike: NavigatorLike | null = browserNavigator()): boolean {
  if (!navigatorLike) return false;

  const userAgent = navigatorLike.userAgent;
  const platform = navigatorLike.platform;
  return /iP(hone|ad|od)/i.test(userAgent) || (platform === 'MacIntel' && navigatorLike.maxTouchPoints > 1);
}

function browserNavigator(): NavigatorLike | null {
  return typeof navigator === 'undefined' ? null : navigator;
}
