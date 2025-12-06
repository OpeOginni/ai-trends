import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

// Random comment: The database connection is established here!

const db = drizzle(process.env.DATABASE_URL!);

export default db;