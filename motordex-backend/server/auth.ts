import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

// Simple file-based user storage (in production, use a proper database)
const USERS_FILE = path.join(__dirname, '../data/users.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize users file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

// User database operations
class UserDB {
  static getUsers(): User[] {
    try {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading users file:', error);
      return [];
    }
  }

  static saveUsers(users: User[]): void {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error('Error saving users file:', error);
    }
  }

  static findUserByEmail(email: string): User | undefined {
    const users = this.getUsers();
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
  }

  static findUserById(id: string): User | undefined {
    const users = this.getUsers();
    return users.find(user => user.id === id);
  }

  static findUserByGoogleId(googleId: string): User | undefined {
    const users = this.getUsers();
    return users.find(user => user.googleId === googleId);
  }

  static createUser(userData: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getUsers();
    const newUser: User = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...userData
    };
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  }

  static updateUser(id: string, updateData: Partial<User>): User | undefined {
    const users = this.getUsers();
    const userIndex = users.findIndex(user => user.id === id);
    if (userIndex === -1) return undefined;

    users[userIndex] = { ...users[userIndex], ...updateData };
    this.saveUsers(users);
    return users[userIndex];
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

// Collection file path
const COLLECTIONS_FILE = path.join(__dirname, '../data/collections.json');

// Initialize collections file if it doesn't exist
if (!fs.existsSync(COLLECTIONS_FILE)) {
  fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify({}));
}

// Collection database operations
class CollectionDB {
  static getCollections(): Record<string, UserCollection> {
    try {
      const data = fs.readFileSync(COLLECTIONS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading collections file:', error);
      return {};
    }
  }

  static saveCollections(collections: Record<string, UserCollection>): void {
    try {
      fs.writeFileSync(COLLECTIONS_FILE, JSON.stringify(collections, null, 2));
    } catch (error) {
      console.error('Error saving collections file:', error);
    }
  }

  static getUserCollection(userId: string): CollectedVehicle[] {
    const collections = this.getCollections();
    return collections[userId]?.vehicles || [];
  }

  static updateUserCollection(userId: string, vehicles: CollectedVehicle[]): void {
    const collections = this.getCollections();
    collections[userId] = {
      userId,
      vehicles,
      lastUpdated: new Date().toISOString()
    };
    this.saveCollections(collections);
  }

  static addVehicleToCollection(userId: string, vehicle: Omit<CollectedVehicle, 'userId'>): CollectedVehicle {
    const collections = this.getCollections();
    const userCollection = collections[userId]?.vehicles || [];
    
    const newVehicle: CollectedVehicle = {
      ...vehicle,
      userId,
      id: vehicle.id || Date.now().toString()
    };
    
    userCollection.push(newVehicle);
    this.updateUserCollection(userId, userCollection);
    
    return newVehicle;
  }

  static removeVehicleFromCollection(userId: string, vehicleId: string): boolean {
    const collections = this.getCollections();
    const userCollection = collections[userId]?.vehicles || [];
    
    const vehicleIndex = userCollection.findIndex(v => v.id === vehicleId);
    if (vehicleIndex === -1) return false;
    
    userCollection.splice(vehicleIndex, 1);
    this.updateUserCollection(userId, userCollection);
    
    return true;
  }

  static clearUserCollection(userId: string): void {
    this.updateUserCollection(userId, []);
  }

  static getCollectionStats(userId: string): { totalVehicles: number; uniqueMakes: number; lastUpdated?: string } {
    const collections = this.getCollections();
    const userCollection = collections[userId];
    
    if (!userCollection) {
      return { totalVehicles: 0, uniqueMakes: 0 };
    }
    
    const vehicles = userCollection.vehicles;
    const uniqueMakes = new Set(vehicles.map(v => v.make)).size;
    
    return {
      totalVehicles: vehicles.length,
      uniqueMakes,
      lastUpdated: userCollection.lastUpdated
    };
  }
}

export { UserDB, CollectionDB }; 