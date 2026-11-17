export function createAudit({ prisma, logger }) {
  return (req, action, { type = null, id = null, details = null } = {}) =>
    prisma.auditLog
      .create({ data: { actorId: req.user?.id ?? null, action, targetType: type, targetId: id === null ? null : String(id), details, ip: req.ip ?? null } })
      .catch((err) => logger.warn({ err, action }, 'audit write failed'));
}
