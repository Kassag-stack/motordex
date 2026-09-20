import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { db } from './database';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // Optional for Google users
  googleId?: string; // Optional for email users
  profilePicture?: string;
  createdAt: string;
}

// Collection interfaces
export interface CollectedVehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  imageUri: string;
  dateSpotted: string;
  fullModel: string; // For duplicate checking (make + model combined)
  registrationNumber?: string;
  vehicleYear?: string;
  color?: string;
}

export interface UserCollection {
  userId: string;
  vehicles: CollectedVehicle[];
  lastUpdated: string;
}

// Friend system interfaces
export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  createdAt: string;
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  email: string;
}

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// Initialize Google OAuth client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// User database operations (SQLite-backed)
const userSelect = 'SELECT id, email, name, password, googleId, profilePicture, createdAt FROM users';

// SQLite stores absent optional fields as NULL; the API contract uses undefined.
function rowToUser(row: any): User | undefined {
  if (!row) return undefined;
  const user: User = {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt
  };
  if (row.password !== null) user.password = row.password;
  if (row.googleId !== null) user.googleId = row.googleId;
  if (row.profilePicture !== null) user.profilePicture = row.profilePicture;
  return user;
}

class UserDB {
  static getUsers(): User[] {
    const rows = db.prepare(`${userSelect} ORDER BY createdAt`).all();
    return rows.map(row => rowToUser(row)!);
  }

  static findUserByEmail(email: string): User | undefined {
    // The email column is COLLATE NOCASE, so this match is case-insensitive.
    return rowToUser(db.prepare(`${userSelect} WHERE email = ?`).get(email));
  }

  static findUserById(id: string): User | undefined {
    return rowToUser(db.prepare(`${userSelect} WHERE id = ?`).get(id));
  }

  static findUserByGoogleId(googleId: string): User | undefined {
    return rowToUser(db.prepare(`${userSelect} WHERE googleId = ?`).get(googleId));
  }

  static createUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...userData
    };

    db.prepare(`
      INSERT INTO users (id, email, name, password, googleId, profilePicture, createdAt)
      VALUES (@id, @email, @name, @password, @googleId, @profilePicture, @createdAt)
    `).run({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      password: newUser.password ?? null,
      googleId: newUser.googleId ?? null,
      profilePicture: newUser.profilePicture ?? null,
      createdAt: newUser.createdAt
    });

    return newUser;
  }

  static updateUser(id: string, updateData: Partial<User>): User | undefined {
    const existing = this.findUserById(id);
    if (!existing) return undefined;

    const updatable = ['email', 'name', 'password', 'googleId', 'profilePicture'] as const;
    const fields = updatable.filter(field => field in updateData);
    if (fields.length === 0) return existing;

    const assignments = fields.map(field => `${field} = @${field}`).join(', ');
    const params: Record<string, unknown> = { id };
    for (const field of fields) params[field] = updateData[field] ?? null;

    db.prepare(`UPDATE users SET ${assignments} WHERE id = @id`).run(params);
    return this.findUserById(id);
  }
}

// Authentication utilities
export class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateJWT(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  static verifyJWT(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  static async verifyGoogleToken(token: string): Promise<any> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    } catch (error) {
      console.error('Google token verification failed:', error);
      throw new Error('Invalid Google token');
    }
  }
}

// Authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const payload = AuthUtils.verifyJWT(token);
  if (!payload) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = UserDB.findUserById(payload.userId);
  if (!user) {
    res.status(403).json({ error: 'User not found' });
    return;
  }

  req.user = user;
  next();
};

// Optional authentication middleware (for routes that work with or without auth)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = AuthUtils.verifyJWT(token);
    if (payload) {
      const user = UserDB.findUserById(payload.userId);
      if (user) {
        req.user = user;
      }
    }
  }

  next();
};

// Collection database operations (SQLite-backed)
const vehicleSelect = `
  SELECT id, userId, make, model, imageUri, dateSpotted, fullModel,
         registrationNumber, vehicleYear, color
  FROM vehicles
`;

function rowToVehicle(row: any): CollectedVehicle {
  const vehicle: CollectedVehicle = {
    id: row.id,
    userId: row.userId,
    make: row.make,
    model: row.model,
    imageUri: row.imageUri,
    dateSpotted: row.dateSpotted,
    fullModel: row.fullModel
  };
  if (row.registrationNumber !== null) vehicle.registrationNumber = row.registrationNumber;
  if (row.vehicleYear !== null) vehicle.vehicleYear = row.vehicleYear;
  if (row.color !== null) vehicle.color = row.color;
  return vehicle;
}

const insertVehicleSQL = `
  INSERT INTO vehicles
    (id, userId, make, model, imageUri, dateSpotted, fullModel, registrationNumber, vehicleYear, color)
  VALUES
    (@id, @userId, @make, @model, @imageUri, @dateSpotted, @fullModel, @registrationNumber, @vehicleYear, @color)
`;

function vehicleParams(userId: string, vehicle: Omit<CollectedVehicle, 'userId'>) {
  return {
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
  };
}

function touchCollection(userId: string, timestamp = new Date().toISOString()): void {
  db.prepare(`
    INSERT INTO collections (userId, lastUpdated) VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET lastUpdated = excluded.lastUpdated
  `).run(userId, timestamp);
}

class CollectionDB {
  static getCollections(): Record<string, UserCollection> {
    const rows = db.prepare('SELECT userId, lastUpdated FROM collections').all() as any[];
    const collections: Record<string, UserCollection> = {};
    for (const row of rows) {
      collections[row.userId] = {
        userId: row.userId,
        vehicles: this.getUserCollection(row.userId),
        lastUpdated: row.lastUpdated
      };
    }
    return collections;
  }

  static getUserCollection(userId: string): CollectedVehicle[] {
    const rows = db.prepare(`${vehicleSelect} WHERE userId = ? ORDER BY rowid`).all(userId) as any[];
    return rows.map(rowToVehicle);
  }

  static updateUserCollection(userId: string, vehicles: CollectedVehicle[]): void {
    const insert = db.prepare(insertVehicleSQL);

    db.transaction(() => {
      db.prepare('DELETE FROM vehicles WHERE userId = ?').run(userId);
      for (const vehicle of vehicles) {
        insert.run(vehicleParams(userId, vehicle));
      }
      touchCollection(userId);
    })();
  }

  static addVehicleToCollection(userId: string, vehicle: Omit<CollectedVehicle, 'userId'>): CollectedVehicle {
    const newVehicle: CollectedVehicle = {
      ...vehicle,
      userId,
      id: vehicle.id || Date.now().toString()
    };

    db.transaction(() => {
      db.prepare(insertVehicleSQL).run(vehicleParams(userId, newVehicle));
      touchCollection(userId);
    })();

    return newVehicle;
  }

  static removeVehicleFromCollection(userId: string, vehicleId: string): boolean {
    return db.transaction(() => {
      const result = db.prepare('DELETE FROM vehicles WHERE userId = ? AND id = ?').run(userId, vehicleId);
      if (result.changes === 0) return false;
      touchCollection(userId);
      return true;
    })();
  }

  static clearUserCollection(userId: string): void {
    this.updateUserCollection(userId, []);
  }

  static getCollectionStats(userId: string): { totalVehicles: number; uniqueMakes: number; lastUpdated?: string } {
    const collection = db.prepare('SELECT lastUpdated FROM collections WHERE userId = ?').get(userId) as any;
    if (!collection) {
      return { totalVehicles: 0, uniqueMakes: 0 };
    }

    const counts = db.prepare(`
      SELECT COUNT(*) AS totalVehicles, COUNT(DISTINCT make) AS uniqueMakes
      FROM vehicles WHERE userId = ?
    `).get(userId) as { totalVehicles: number; uniqueMakes: number };

    return {
      totalVehicles: counts.totalVehicles,
      uniqueMakes: counts.uniqueMakes,
      lastUpdated: collection.lastUpdated
    };
  }
}

// Friend database operations (SQLite-backed)
const friendshipSelect = 'SELECT id, user1Id, user2Id, createdAt FROM friendships';
const requestSelect = 'SELECT id, fromUserId, toUserId, status, createdAt, updatedAt FROM friend_requests';

class FriendDB {
  static getFriendships(): Friendship[] {
    return db.prepare(`${friendshipSelect} ORDER BY createdAt`).all() as Friendship[];
  }

  static getFriendRequests(): FriendRequest[] {
    return db.prepare(`${requestSelect} ORDER BY createdAt`).all() as FriendRequest[];
  }

  static createFriendRequest(fromUserId: string, toUserId: string): FriendRequest {
    const existingRequest = db.prepare(`
      ${requestSelect}
      WHERE (fromUserId = @from AND toUserId = @to) OR (fromUserId = @to AND toUserId = @from)
    `).get({ from: fromUserId, to: toUserId });

    if (existingRequest) {
      throw new Error('Friend request already exists');
    }

    const now = new Date().toISOString();
    const newRequest: FriendRequest = {
      id: uuidv4(),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    db.prepare(`
      INSERT INTO friend_requests (id, fromUserId, toUserId, status, createdAt, updatedAt)
      VALUES (@id, @fromUserId, @toUserId, @status, @createdAt, @updatedAt)
    `).run(newRequest);

    return newRequest;
  }

  static acceptFriendRequest(requestId: string): Friendship | null {
    return db.transaction(() => {
      const request = db.prepare(`${requestSelect} WHERE id = ?`).get(requestId) as FriendRequest | undefined;
      if (!request) return null;

      const now = new Date().toISOString();
      db.prepare('UPDATE friend_requests SET status = ?, updatedAt = ? WHERE id = ?')
        .run('accepted', now, requestId);

      const friendship: Friendship = {
        id: uuidv4(),
        user1Id: request.fromUserId,
        user2Id: request.toUserId,
        createdAt: now
      };

      db.prepare(`
        INSERT INTO friendships (id, user1Id, user2Id, createdAt)
        VALUES (@id, @user1Id, @user2Id, @createdAt)
      `).run(friendship);

      return friendship;
    })();
  }

  static rejectFriendRequest(requestId: string): boolean {
    const result = db.prepare('UPDATE friend_requests SET status = ?, updatedAt = ? WHERE id = ?')
      .run('rejected', new Date().toISOString(), requestId);
    return result.changes > 0;
  }

  static getUserFriends(userId: string): string[] {
    const rows = db.prepare(`
      SELECT CASE WHEN user1Id = @userId THEN user2Id ELSE user1Id END AS friendId
      FROM friendships
      WHERE user1Id = @userId OR user2Id = @userId
      ORDER BY createdAt
    `).all({ userId }) as { friendId: string }[];
    return rows.map(row => row.friendId);
  }

  static areFriends(userId1: string, userId2: string): boolean {
    const row = db.prepare(`
      SELECT 1 FROM friendships
      WHERE (user1Id = @a AND user2Id = @b) OR (user1Id = @b AND user2Id = @a)
      LIMIT 1
    `).get({ a: userId1, b: userId2 });
    return row !== undefined;
  }

  static removeFriendship(userId1: string, userId2: string): boolean {
    return db.transaction(() => {
      const result = db.prepare(`
        DELETE FROM friendships
        WHERE (user1Id = @a AND user2Id = @b) OR (user1Id = @b AND user2Id = @a)
      `).run({ a: userId1, b: userId2 });

      if (result.changes === 0) return false;

      // Drop any request between the pair so they can befriend each other again later.
      db.prepare(`
        DELETE FROM friend_requests
        WHERE (fromUserId = @a AND toUserId = @b) OR (fromUserId = @b AND toUserId = @a)
      `).run({ a: userId1, b: userId2 });

      return true;
    })();
  }

  static getPendingRequests(userId: string): FriendRequest[] {
    return db.prepare(`${requestSelect} WHERE toUserId = ? AND status = 'pending' ORDER BY createdAt`)
      .all(userId) as FriendRequest[];
  }

  static getSentRequests(userId: string): FriendRequest[] {
    return db.prepare(`${requestSelect} WHERE fromUserId = ? AND status = 'pending' ORDER BY createdAt`)
      .all(userId) as FriendRequest[];
  }
}

export { UserDB, CollectionDB, FriendDB };
