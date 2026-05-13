export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  swaggerEnabled: boolean;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    synchronize: boolean;
    logging: boolean;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  loans: {
    maxActivePerUser: number;
    dailyFineRate: number;
    maxLoanDays: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() === 'true',
  database: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    name: process.env.DB_NAME as string,
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false').toLowerCase() === 'true',
    logging: (process.env.DB_LOGGING ?? 'false').toLowerCase() === 'true',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  },
  loans: {
    maxActivePerUser: parseInt(process.env.MAX_ACTIVE_LOANS ?? '3', 10),
    dailyFineRate: parseFloat(process.env.DAILY_FINE_RATE ?? '0.50'),
    maxLoanDays: parseInt(process.env.MAX_LOAN_DAYS ?? '30', 10),
  },
});
