import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1747180800000 implements MigrationInterface {
  name = 'InitialSchema1747180800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── users ──────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'librarian', 'member')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         uuid                        NOT NULL DEFAULT uuid_generate_v4(),
        "email"      character varying           NOT NULL,
        "name"       character varying           NOT NULL,
        "password"   character varying           NOT NULL,
        "role"       "public"."users_role_enum"  NOT NULL DEFAULT 'member',
        "createdAt"  TIMESTAMP                   NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP                   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users"       PRIMARY KEY ("id")
      )
    `);

    // ── items ──────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."items_type_enum" AS ENUM('book', 'magazine', 'equipment')`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."items_status_enum" AS ENUM('available', 'borrowed', 'reserved', 'lost', 'inactive')`,
    );

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id"        uuid                          NOT NULL DEFAULT uuid_generate_v4(),
        "code"      character varying             NOT NULL,
        "title"     character varying             NOT NULL,
        "type"      "public"."items_type_enum"    NOT NULL,
        "status"    "public"."items_status_enum"  NOT NULL DEFAULT 'available',
        "createdAt" TIMESTAMP                     NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_items_code" UNIQUE ("code"),
        CONSTRAINT "PK_items"      PRIMARY KEY ("id")
      )
    `);

    // ── loans ──────────────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."loans_status_enum" AS ENUM('active', 'returned', 'lost')`,
    );

    await queryRunner.query(`
      CREATE TABLE "loans" (
        "id"          uuid                         NOT NULL DEFAULT uuid_generate_v4(),
        "member_id"   uuid                         NOT NULL,
        "item_id"     uuid                         NOT NULL,
        "loanedAt"    TIMESTAMP                    NOT NULL,
        "dueAt"       TIMESTAMP                    NOT NULL,
        "returnedAt"  TIMESTAMP                    DEFAULT NULL,
        "status"      "public"."loans_status_enum" NOT NULL DEFAULT 'active',
        "fineAmount"  numeric(10,2)                NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP                    NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP                    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_loans_status" ON "loans" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_loans_dueAt"  ON "loans" ("dueAt")`);

    await queryRunner.query(`
      ALTER TABLE "loans"
        ADD CONSTRAINT "FK_loans_member"
        FOREIGN KEY ("member_id") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "loans"
        ADD CONSTRAINT "FK_loans_item"
        FOREIGN KEY ("item_id") REFERENCES "items"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    // ── reservations ───────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('pending', 'ready', 'fulfilled', 'cancelled', 'expired')`,
    );

    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id"         uuid                                  NOT NULL DEFAULT uuid_generate_v4(),
        "member_id"  uuid                                  NOT NULL,
        "item_id"    uuid                                  NOT NULL,
        "status"     "public"."reservations_status_enum"  NOT NULL DEFAULT 'pending',
        "readyAt"    TIMESTAMP                             DEFAULT NULL,
        "expiresAt"  TIMESTAMP                             DEFAULT NULL,
        "createdAt"  TIMESTAMP                             NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP                             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_status"  ON "reservations" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_item_id" ON "reservations" ("item_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "reservations"
        ADD CONSTRAINT "FK_reservations_member"
        FOREIGN KEY ("member_id") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "reservations"
        ADD CONSTRAINT "FK_reservations_item"
        FOREIGN KEY ("item_id") REFERENCES "items"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_reservations_member"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reservations_item_id"`);
    await queryRunner.query(`DROP INDEX "IDX_reservations_status"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP TYPE "public"."reservations_status_enum"`);

    await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_loans_item"`);
    await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_loans_member"`);
    await queryRunner.query(`DROP INDEX "IDX_loans_dueAt"`);
    await queryRunner.query(`DROP INDEX "IDX_loans_status"`);
    await queryRunner.query(`DROP TABLE "loans"`);
    await queryRunner.query(`DROP TYPE "public"."loans_status_enum"`);

    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TYPE "public"."items_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."items_type_enum"`);

    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
