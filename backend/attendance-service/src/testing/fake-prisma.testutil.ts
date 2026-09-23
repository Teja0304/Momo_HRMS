import { v4 as uuidv4 } from 'uuid';

/**
 * A minimal, in-memory stand-in for PrismaService, implementing only
 * the methods/shapes AttendanceService actually calls. This is NOT a
 * general Prisma mock and does not simulate real row locking /
 * transaction isolation — it runs everything sequentially in-process,
 * which is sufficient for testing business-rule logic and the
 * acceptance scenario, but NOT a substitute for a real concurrency
 * test against MySQL (see test/concurrency/README.md for that).
 */

type Where = Record<string, unknown>;

function matchesWhere(record: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = record[key];

    if (condition === null) {
      return value === null;
    }

    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const cond = condition as { in?: unknown[]; gte?: unknown; lte?: unknown };
      if (cond.in) {
        return cond.in.includes(value);
      }
      if (cond.gte !== undefined || cond.lte !== undefined) {
        const v = value instanceof Date ? value.getTime() : (value as number);
        if (cond.gte !== undefined) {
          const gte = cond.gte instanceof Date ? cond.gte.getTime() : (cond.gte as number);
          if (v < gte) return false;
        }
        if (cond.lte !== undefined) {
          const lte = cond.lte instanceof Date ? cond.lte.getTime() : (cond.lte as number);
          if (v > lte) return false;
        }
        return true;
      }
      return false;
    }

    if (condition instanceof Date) {
      return value instanceof Date && value.getTime() === condition.getTime();
    }

    return value === condition;
  });
}

function applyOrderBy<T extends Record<string, unknown>>(
  records: T[],
  orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[],
): T[] {
  if (!orderBy) return records;
  const rules = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...records].sort((a, b) => {
    for (const rule of rules) {
      const [field, dir] = Object.entries(rule)[0] as [string, 'asc' | 'desc'];
      const av = a[field] as Date | number | string;
      const bv = b[field] as Date | number | string;
      let cmp = 0;
      if (av instanceof Date && bv instanceof Date) {
        cmp = av.getTime() - bv.getTime();
      } else if (av < bv) {
        cmp = -1;
      } else if (av > bv) {
        cmp = 1;
      }
      if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

export class FakePrismaService {
  sessions: Record<string, unknown>[] = [];
  pauses: Record<string, unknown>[] = [];
  events: Record<string, unknown>[] = [];
  locks = new Set<string>();

  employeeAttendanceLock = {
    upsert: async ({ where }: { where: { employeeId: string } }) => {
      this.locks.add(where.employeeId);
      return { employeeId: where.employeeId };
    },
  };

  attendanceSession = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const record = {
        id: uuidv4(),
        checkOutAt: null,
        currentPauseStartedAt: null,
        currentGraceDeadline: null,
        checkoutType: null,
        checkoutReason: null,
        totalWorkingSeconds: 0,
        reopenReason: null,
        reopenAuthorizedBy: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      this.sessions.push(record);
      return { ...record };
    },
    findFirst: async ({ where, orderBy }: { where?: Where; orderBy?: any } = {}) => {
      let results = this.sessions.filter((s) => matchesWhere(s, where));
      results = applyOrderBy(results, orderBy);
      return results[0] ? { ...results[0] } : null;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: { pauses?: boolean } }) => {
      const record = this.sessions.find((s) => s.id === where.id);
      if (!record) return null;
      return this.attachIncludes(record, include);
    },
    findUniqueOrThrow: async (args: { where: { id: string }; include?: { pauses?: boolean } }) => {
      const record = await this.attendanceSession.findUnique(args);
      if (!record) throw new Error('AttendanceSession not found');
      return record;
    },
    findMany: async ({
      where,
      orderBy,
      skip = 0,
      take,
    }: { where?: Where; orderBy?: any; skip?: number; take?: number } = {}) => {
      let results = this.sessions.filter((s) => matchesWhere(s, where));
      results = applyOrderBy(results, orderBy);
      if (skip) results = results.slice(skip);
      if (take !== undefined) results = results.slice(0, take);
      return results.map((r) => this.attachIncludes(r, { pauses: true }));
    },
    count: async ({ where }: { where?: Where } = {}) =>
      this.sessions.filter((s) => matchesWhere(s, where)).length,
    updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const matches = this.sessions.filter((s) => matchesWhere(s, where));
      for (const m of matches) Object.assign(m, data, { updatedAt: new Date() });
      return { count: matches.length };
    },
  };

  attendancePause = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const record = {
        id: uuidv4(),
        endedAt: null,
        durationSeconds: null,
        endReason: null,
        createdAt: now,
        ...data,
      };
      this.pauses.push(record);
      return { ...record };
    },
    findFirst: async ({ where }: { where?: Where } = {}) => {
      const record = this.pauses.find((p) => matchesWhere(p, where));
      return record ? { ...record } : null;
    },
    updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const matches = this.pauses.filter((p) => matchesWhere(p, where));
      for (const m of matches) Object.assign(m, data);
      return { count: matches.length };
    },
  };

  attendanceEvent = {
    findUnique: async ({ where }: { where: { clientEventId: string } }) => {
      const record = this.events.find((e) => e.clientEventId === where.clientEventId);
      return record ? { ...record } : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (this.events.some((e) => e.clientEventId === data.clientEventId)) {
        const err = new Error('Unique constraint failed on the fields: (`client_event_id`)') as Error & {
          code: string;
        };
        err.code = 'P2002';
        throw err;
      }
      const now = new Date();
      const record = { id: uuidv4(), createdAt: now, ...data };
      this.events.push(record);
      return { ...record };
    },
    upsert: async ({
      where,
      create,
    }: {
      where: { clientEventId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      const existing = this.events.find((e) => e.clientEventId === where.clientEventId);
      if (existing) return { ...existing };
      return this.attendanceEvent.create({ data: create });
    },
  };

  async $queryRawUnsafe(..._args: unknown[]): Promise<unknown[]> {
    return [];
  }

  async $transaction<T>(arg: (() => Promise<T>)[] | ((tx: this) => Promise<T>)): Promise<T | T[]> {
    if (Array.isArray(arg)) {
      const results: T[] = [];
      for (const p of arg as unknown as Promise<T>[]) {
        results.push(await p);
      }
      return results;
    }
    return (arg as (tx: this) => Promise<T>)(this);
  }

  private attachIncludes(record: Record<string, unknown>, include?: { pauses?: boolean }) {
    const result = { ...record };
    if (include?.pauses) {
      result.pauses = this.pauses
        .filter((p) => p.attendanceSessionId === record.id)
        .map((p) => ({ ...p }));
    }
    return result;
  }
}
