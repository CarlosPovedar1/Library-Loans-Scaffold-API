import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

// ─── helpers ──────────────────────────────────────────────────────────────────

function futureDueAt(daysFromNow = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

async function registerAndLogin(
  app: INestApplication,
  email: string,
  password = 'Password1!',
  role = 'member',
  name = 'Test User',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, name, role })
    .expect(201);
  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    userId: res.body.user.id,
  };
}

async function createItem(
  app: INestApplication,
  adminToken: string,
  code: string,
  type: string = 'book',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/items')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ code, title: `Item ${code}`, type })
    .expect(201);
  return res.body.id;
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe('Library Loans API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const config = app.get(ConfigService);
    const apiPrefix = config.get<string>('apiPrefix', 'api');

    app.setGlobalPrefix(apiPrefix);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Truncate all tables between tests in dependency order
    await dataSource.query(
      `TRUNCATE "reservations", "loans", "refresh_tokens", "items", "users" RESTART IDENTITY CASCADE`,
    );
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 201 with accessToken, refreshToken, and user (no password)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'alice@test.com', password: 'Password1!', name: 'Alice' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          id: expect.any(String),
          email: 'alice@test.com',
          role: 'member',
        }),
      });
      expect(res.body.user.password).toBeUndefined();
    });

    it('returns 409 when email already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'Password1!', name: 'Dup' });

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'Password1!', name: 'Dup2' })
        .expect(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens on valid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'bob@test.com', password: 'Password1!', name: 'Bob' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bob@test.com', password: 'Password1!' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('returns 401 on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'carol@test.com', password: 'Password1!', name: 'Carol' });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'carol@test.com', password: 'WrongPass1!' })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new accessToken given a valid refresh token', async () => {
      const { refreshToken } = await registerAndLogin(app, 'refresh@test.com');

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('returns 401 when refresh token is already revoked', async () => {
      const { refreshToken } = await registerAndLogin(app, 'revoked@test.com');

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Token was rotated, original is now revoked
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the refresh token so subsequent refresh fails', async () => {
      const { refreshToken } = await registerAndLogin(app, 'logout@test.com');

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  // ─── Items ────────────────────────────────────────────────────────────────

  describe('Items CRUD', () => {
    let adminToken: string;

    beforeEach(async () => {
      ({ accessToken: adminToken } = await registerAndLogin(
        app,
        'admin@test.com',
        'Password1!',
        'admin',
        'Admin',
      ));
    });

    it('POST /api/items — admin creates an item (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'BK-001', title: 'Clean Code', type: 'book' })
        .expect(201);

      expect(res.body).toMatchObject({ code: 'BK-001', status: 'available' });
    });

    it('GET /api/items — returns list', async () => {
      await createItem(app, adminToken, 'BK-002');
      const res = await request(app.getHttpServer())
        .get('/api/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('member cannot create an item (403)', async () => {
      const { accessToken: memberToken } = await registerAndLogin(app, 'mem@test.com');

      await request(app.getHttpServer())
        .post('/api/items')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ code: 'BK-003', title: 'Refactoring', type: 'book' })
        .expect(403);
    });
  });

  // ─── Loan FSM matrix ──────────────────────────────────────────────────────

  describe('Loan FSM', () => {
    let adminToken: string;
    let memberToken: string;
    let memberId: string;
    let itemId: string;

    beforeEach(async () => {
      ({ accessToken: adminToken } = await registerAndLogin(
        app,
        'admin@test.com',
        'Password1!',
        'admin',
        'Admin',
      ));
      ({ accessToken: memberToken, userId: memberId } = await registerAndLogin(
        app,
        'member@test.com',
      ));
      itemId = await createItem(app, adminToken, 'FSM-001');
    });

    it('creates a loan (available → borrowed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(201);

      expect(res.body.status).toBe('active');

      const item = await request(app.getHttpServer())
        .get(`/api/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(item.body.status).toBe('borrowed');
    });

    it('cannot borrow an already borrowed item (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) });

      const { accessToken: mem2Token } = await registerAndLogin(app, 'mem2@test.com');

      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(409);
    });

    it('cannot exceed MAX_ACTIVE_LOANS (409)', async () => {
      const extraItems = await Promise.all([
        createItem(app, adminToken, 'EXTRA-1'),
        createItem(app, adminToken, 'EXTRA-2'),
        createItem(app, adminToken, 'EXTRA-3'),
      ]);

      // Create 3 active loans (hits the default limit)
      for (const id of extraItems) {
        await request(app.getHttpServer())
          .post('/api/loans')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ itemId: id, dueAt: futureDueAt(14) })
          .expect(201);
      }

      // 4th loan must be 409
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(409);
    });

    it('dueAt must be in the future (400)', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: past })
        .expect(400);
    });

    it.each([
      ['active → returned', 'return', 'returned'],
      ['active → lost',     'lost',   'lost'],
    ])('loan FSM: %s via PATCH /:id/%s', async (_label, action, expectedStatus) => {
      const loanRes = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(201);

      const loanId: string = loanRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/api/loans/${loanId}/${action}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe(expectedStatus);
    });

    it('member cannot return a loan (403)', async () => {
      const loanRes = await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/loans/${loanRes.body.id}/return`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('member can only see their own loans', async () => {
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ itemId, dueAt: futureDueAt(14) });

      const { accessToken: mem2Token } = await registerAndLogin(app, 'mem2@test.com');

      const res = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${mem2Token}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ─── Reservation FSM matrix ───────────────────────────────────────────────

  describe('Reservation FSM', () => {
    let adminToken: string;
    let mem1Token: string;
    let mem2Token: string;
    let itemId: string;

    beforeEach(async () => {
      ({ accessToken: adminToken } = await registerAndLogin(
        app,
        'admin@test.com',
        'Password1!',
        'admin',
        'Admin',
      ));
      ({ accessToken: mem1Token } = await registerAndLogin(app, 'mem1@test.com'));
      ({ accessToken: mem2Token } = await registerAndLogin(app, 'mem2@test.com'));

      itemId = await createItem(app, adminToken, 'RES-001');

      // Borrow item so it becomes 'borrowed' (required to reserve)
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId, dueAt: futureDueAt(14) });
    });

    it('cannot reserve an available item (400)', async () => {
      const freshItem = await createItem(app, adminToken, 'AVAIL-001');

      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId: freshItem })
        .expect(400);
    });

    it('creates a PENDING reservation for a borrowed item (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId })
        .expect(201);

      expect(res.body.status).toBe('pending');
    });

    it('duplicate active reservation returns 409', async () => {
      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId });

      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId })
        .expect(409);
    });

    it.each([
      ['pending', 'cancelled'],
    ])('reservation FSM: %s → cancel → %s', async (initialStatus, expectedStatus) => {
      const resRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId })
        .expect(201);

      expect(resRes.body.status).toBe(initialStatus);

      const cancelRes = await request(app.getHttpServer())
        .patch(`/api/reservations/${resRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${mem2Token}`)
        .expect(200);

      expect(cancelRes.body.status).toBe(expectedStatus);
      expect(cancelRes.body.cancelledAt).not.toBeNull();
    });

    it('member cannot cancel another member\'s reservation (403)', async () => {
      const { accessToken: mem3Token } = await registerAndLogin(app, 'mem3@test.com');

      const resRes = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId });

      await request(app.getHttpServer())
        .patch(`/api/reservations/${resRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${mem3Token}`)
        .expect(403);
    });
  });

  // ─── FIFO reservation queue ───────────────────────────────────────────────

  describe('FIFO reservation queue', () => {
    let adminToken: string;
    let borrowerToken: string;
    let mem1Token: string;
    let mem2Token: string;
    let mem3Token: string;
    let itemId: string;

    beforeEach(async () => {
      ({ accessToken: adminToken } = await registerAndLogin(
        app,
        'admin@test.com',
        'Password1!',
        'admin',
        'Admin',
      ));
      ({ accessToken: borrowerToken } = await registerAndLogin(app, 'borrower@test.com'));
      ({ accessToken: mem1Token } = await registerAndLogin(app, 'fifo1@test.com'));
      ({ accessToken: mem2Token } = await registerAndLogin(app, 'fifo2@test.com'));
      ({ accessToken: mem3Token } = await registerAndLogin(app, 'fifo3@test.com'));

      itemId = await createItem(app, adminToken, 'FIFO-001');

      // Borrow the item first
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${borrowerToken}`)
        .send({ itemId, dueAt: futureDueAt(14) });
    });

    it('activates first PENDING reservation (FIFO) when loan is returned', async () => {
      // mem1 and mem2 both reserve in order
      const r1 = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId })
        .expect(201);

      // Get the loan id to return it
      const loansRes = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const loanId: string = loansRes.body[0].id;

      // Return the loan — should activate mem1's reservation
      await request(app.getHttpServer())
        .patch(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // mem1's reservation should now be READY
      const res1 = await request(app.getHttpServer())
        .get(`/api/reservations/${r1.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Check reservation list — mem1 should be READY
      const allReservations = await request(app.getHttpServer())
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ itemId })
        .expect(200);

      const readyRes = allReservations.body.find((r: { status: string }) => r.status === 'ready');
      expect(readyRes).toBeDefined();
      expect(readyRes.readyAt).not.toBeNull();
      expect(readyRes.expiresAt).not.toBeNull();

      void res1; // used above for destructuring
    });

    it('cannot borrow a RESERVED item if another member holds the READY reservation', async () => {
      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId });

      const loansRes = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`);
      const loanId: string = loansRes.body[0].id;

      await request(app.getHttpServer())
        .patch(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${adminToken}`);

      // item is now RESERVED for mem1 — mem2 tries to borrow directly
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId, dueAt: futureDueAt(14) })
        .expect(403);
    });

    it('READY reservation holder can borrow the item (RESERVED → BORROWED, reservation COMPLETED)', async () => {
      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId });

      const loansRes = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`);
      const loanId: string = loansRes.body[0].id;

      await request(app.getHttpServer())
        .patch(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${adminToken}`);

      // mem1 borrows
      await request(app.getHttpServer())
        .post('/api/loans')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId, dueAt: futureDueAt(7) })
        .expect(201);

      // Reservation should be COMPLETED
      const allReservations = await request(app.getHttpServer())
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ itemId });

      const completed = allReservations.body.find(
        (r: { status: string }) => r.status === 'completed',
      );
      expect(completed).toBeDefined();
      expect(completed.completedAt).not.toBeNull();
    });

    it('cancelling READY reservation activates next PENDING one (FIFO)', async () => {
      const r1 = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem1Token}`)
        .send({ itemId });

      const r2 = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem2Token}`)
        .send({ itemId });

      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${mem3Token}`)
        .send({ itemId });

      const loansRes = await request(app.getHttpServer())
        .get('/api/loans')
        .set('Authorization', `Bearer ${adminToken}`);
      const loanId: string = loansRes.body[0].id;

      await request(app.getHttpServer())
        .patch(`/api/loans/${loanId}/return`)
        .set('Authorization', `Bearer ${adminToken}`);

      // mem1's reservation is now READY — cancel it
      await request(app.getHttpServer())
        .patch(`/api/reservations/${r1.body.id}/cancel`)
        .set('Authorization', `Bearer ${mem1Token}`)
        .expect(200);

      // mem2 should now be READY
      const allReservations = await request(app.getHttpServer())
        .get('/api/reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ itemId });

      const mem2Res = allReservations.body.find(
        (r: { id: string }) => r.id === r2.body.id,
      );
      expect(mem2Res.status).toBe('ready');
    });
  });

  // ─── Expiry endpoint ──────────────────────────────────────────────────────

  describe('PATCH /api/reservations/expire-ready', () => {
    it('only admin/librarian can call expire-ready (403 for member)', async () => {
      const { accessToken: memberToken } = await registerAndLogin(app, 'expmem@test.com');

      await request(app.getHttpServer())
        .patch('/api/reservations/expire-ready')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('admin can call expire-ready and get { expired: number }', async () => {
      const { accessToken: adminToken } = await registerAndLogin(
        app,
        'adminexp@test.com',
        'Password1!',
        'admin',
        'Admin',
      );

      const res = await request(app.getHttpServer())
        .patch('/api/reservations/expire-ready')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(typeof res.body.expired).toBe('number');
    });
  });

  // ─── Guards ───────────────────────────────────────────────────────────────

  describe('Auth guards', () => {
    it('returns 401 on unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/items').expect(401);
    });

    it('returns 401 on invalid Bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/items')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);
    });
  });
});
