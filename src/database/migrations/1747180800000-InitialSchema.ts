import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1747180800000 implements MigrationInterface {
  name = 'InitialSchema1747180800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         uuid                        NOT NULL DEFAULT uuid_generate_v4(),
        "email"      character varying           NOT NULL,
        "name"       character varying           NOT NULL,
        "password"   character varying           NOT NULL,
        "role"       "public"."users_role_enum"  NOT NULL DEFAULT 'user',
        "createdAt"  TIMESTAMP                   NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP                   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id"               uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "title"            character varying NOT NULL,
        "author"           character varying NOT NULL,
        "isbn"             character varying NOT NULL,
        "totalCopies"      integer           NOT NULL DEFAULT 1,
        "availableCopies"  integer           NOT NULL DEFAULT 1,
        "createdAt"        TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_items_isbn" UNIQUE ("isbn"),
        CONSTRAINT "PK_items" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."loans_status_enum" AS ENUM('active', 'returned', 'overdue')`,
    );

    await queryRunner.query(`
      CREATE TABLE "loans" (
        "id"          uuid                         NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"     uuid                         NOT NULL,
        "item_id"     uuid                         NOT NULL,
        "loanDate"    TIMESTAMP                    NOT NULL,
        "dueDate"     TIMESTAMP                    NOT NULL,
        "returnDate"  TIMESTAMP                    DEFAULT NULL,
        "status"      "public"."loans_status_enum" NOT NULL DEFAULT 'active',
        "fineAmount"  numeric(10,2)                NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP                    NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP                    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loans" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "loans"
        ADD CONSTRAINT "FK_loans_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "loans"
        ADD CONSTRAINT "FK_loans_item"
        FOREIGN KEY ("item_id") REFERENCES "items"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_loans_item"`);
    await queryRunner.query(`ALTER TABLE "loans" DROP CONSTRAINT "FK_loans_user"`);
    await queryRunner.query(`DROP TABLE "loans"`);
    await queryRunner.query(`DROP TYPE "public"."loans_status_enum"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
