const PLATFORMS = [
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];
const BROWSERS = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

export function describeDevice(userAgent) {
  if (!userAgent) return 'Unknown device';
  const find = (table) => table.find(([re]) => re.test(userAgent))?.[1];
  return [find(BROWSERS), find(PLATFORMS)].filter(Boolean).join(' on ') || 'Unknown device';
}

// One row per active session: the newest unrevoked token in each rotation chain
export async function listSessions(prisma, userId, currentSessionId = null) {
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { sessionId: true, userAgent: true, ip: true, createdAt: true },
  });
  const firstSeen = await prisma.refreshToken.groupBy({ by: ['sessionId'], where: { userId, sessionId: { in: tokens.map((t) => t.sessionId) } }, _min: { createdAt: true } });
  const started = new Map(firstSeen.map((r) => [r.sessionId, r._min.createdAt]));
  const seen = new Set();
  return tokens
    .filter((t) => !seen.has(t.sessionId) && seen.add(t.sessionId))
    .map((t) => ({ id: t.sessionId, device: describeDevice(t.userAgent), userAgent: t.userAgent, ip: t.ip, lastActiveAt: t.createdAt, startedAt: started.get(t.sessionId) ?? t.createdAt, current: t.sessionId === currentSessionId }));
}
