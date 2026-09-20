import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// database.ts is imported before server.ts runs dotenv.config(), so load the
// env here too - otherwise DB_FILE (and JWT_SECRET in auth.ts) would be unset.
dotenv.config();

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_FILE = process.env.DB_FILE || path.join(dataDir, 'motordex.db');

export const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password TEXT,
    googleId TEXT UNIQUE,
    profilePicture TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    imageUri TEXT NOT NULL,
    dateSpotted TEXT NOT NULL,
    fullModel TEXT NOT NULL,
    registrationNumber TEXT,
    vehicleYear TEXT,
    color TEXT,
    PRIMARY KEY (userId, id)
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_userId ON vehicles(userId);

  -- One row per user, tracking when their collection last changed.
  CREATE TABLE IF NOT EXISTS collections (
    userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lastUpdated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user1Id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2Id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user1Id);
  CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user2Id);

  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    fromUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toUserId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requests_to ON friend_requests(toUserId, status);
  CREATE INDEX IF NOT EXISTS idx_requests_from ON friend_requests(fromUserId, status);
`);

/**
 * One-time import of the legacy JSON files. Runs only when the users table is
 * empty, so restarting the server never re-imports or duplicates rows.
 */
function migrateFromJSON(): void {
  const userCount = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (userCount > 0) return;

  const readJSON = <T>(file: string, fallback: T): T => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch (error) {
      console.error(`Error reading ${file} during migration:`, error);
      return fallback;
    }
  };

  const users = readJSON<any[]>('users.json', []);
  if (users.length === 0) return;

  const collections = readJSON<Record<string, any>>('collections.json', {});
  const friendships = readJSON<any[]>('friends.json', []);
  const requests = readJSON<any[]>('friendRequests.json', []);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, name, password, googleId, profilePicture, createdAt)
    VALUES (@id, @email, @name, @password, @googleId, @profilePicture, @createdAt)
  `);
  const insertCollection = db.prepare(`
    INSERT OR REPLACE INTO collections (userId, lastUpdated) VALUES (?, ?)
  `);
  const insertVehicle = db.prepare(`
    INSERT OR IGNORE INTO vehicles
      (id, userId, make, model, imageUri, dateSpotted, fullModel, registrationNumber, vehicleYear, color)
    VALUES
      (@id, @userId, @make, @model, @imageUri, @dateSpotted, @fullModel, @registrationNumber, @vehicleYear, @color)
  `);
  const insertFriendship = db.prepare(`
    INSERT OR IGNORE INTO friendships (id, user1Id, user2Id, createdAt)
    VALUES (@id, @user1Id, @user2Id, @createdAt)
  `);
  const insertRequest = db.prepare(`
    INSERT OR IGNORE INTO friend_requests (id, fromUserId, toUserId, status, createdAt, updatedAt)
    VALUES (@id, @fromUserId, @toUserId, @status, @createdAt, @updatedAt)
  `);

  const knownUser = (id: string) => users.some(u => u.id === id);

  const run = db.transaction(() => {
    for (const user of users) {
      insertUser.run({
        id: user.id,
        email: user.email,
        name: user.name,
        password: user.password ?? null,
        googleId: user.googleId ?? null,
        profilePicture: user.profilePicture ?? null,
        createdAt: user.createdAt
      });
    }

    for (const [userId, collection] of Object.entries(collections)) {
      if (!knownUser(userId)) continue;
      insertCollection.run(userId, collection?.lastUpdated || new Date().toISOString());
      for (const vehicle of collection?.vehicles || []) {
        insertVehicle.run({
          id: String(vehicle.id),
          userId,
          make: vehicle.make,
          model: vehicle.model,
          imageUri: vehicle.imageUri,
          dateSpotted: vehicle.dateSpotted,
          fullModel: vehicle.fullModel,
          registrationNumber: vehicle.registrationNumber ?? null,
          vehicleYear: vehicle.vehicleYear ?? null,
          color: vehicle.color ?? null
        });
      }
    }

    for (const friendship of friendships) {
      if (!knownUser(friendship.user1Id) || !knownUser(friendship.user2Id)) continue;
      insertFriendship.run(friendship);
    }

    for (const request of requests) {
      if (!knownUser(request.fromUserId) || !knownUser(request.toUserId)) continue;
      insertRequest.run(request);
    }
  });

  run();

  const counts = {
    users: (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n,
    vehicles: (db.prepare('SELECT COUNT(*) AS n FROM vehicles').get() as { n: number }).n,
    friendships: (db.prepare('SELECT COUNT(*) AS n FROM friendships').get() as { n: number }).n,
    friendRequests: (db.prepare('SELECT COUNT(*) AS n FROM friend_requests').get() as { n: number }).n
  };
  console.log('Migrated JSON data into SQLite:', counts);
}

migrateFromJSON();

export default db;
