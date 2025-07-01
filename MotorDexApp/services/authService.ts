import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Configure WebBrowser for Google OAuth
WebBrowser.maybeCompleteAuthSession();

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

// Configuration - Update these values for your setup
const API_BASE_URL = 'http://10.0.2.2:3000'; // For Android Studio emulator (change to your local IP for physical device)
const TOKEN_KEY = 'motordex_auth_token';
const USER_KEY = 'motordex_user_data';

// Google OAuth configuration - Replace with your actual client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = 'your_google_client_id_here.apps.googleusercontent.com';

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private authToken: string | null = null;

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Initialize authentication state
  private async initializeAuth(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userData = await AsyncStorage.getItem(USER_KEY);
      
      if (token && userData) {
        this.authToken = token;
        this.currentUser = JSON.parse(userData);
        
        // Verify token is still valid
        const isValid = await this.verifyToken();
        if (!isValid) {
          await this.logout();
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      await this.logout();
    }
  }

  // Store authentication data securely
  private async storeAuthData(authResponse: AuthResponse): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, authResponse.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
      this.authToken = authResponse.token;
      this.currentUser = authResponse.user;
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  // Get authentication headers
  private getAuthHeaders(): Record<string, string> {
    return this.authToken ? {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    };
  }

  // Email/Password Registration
  public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, credentials, {
        headers: this.getAuthHeaders(),
      });
      
      const authResponse: AuthResponse = response.data;
      await this.storeAuthData(authResponse);
      return authResponse;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Registration failed');
      }
      throw new Error('Network error during registration');
    }
  }

  // Email/Password Login
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, credentials, {
        headers: this.getAuthHeaders(),
      });
      
      const authResponse: AuthResponse = response.data;
      await this.storeAuthData(authResponse);
      return authResponse;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Login failed');
      }
      throw new Error('Network error during login');
    }
  }

  // Google OAuth Login
  public async loginWithGoogle(): Promise<AuthResponse> {
    try {
      // Create Google OAuth request
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
        redirectUri: AuthSession.makeRedirectUri(),
      });

      const result = await request.promptAsync({
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      });

      if (result.type === 'success' && result.params.id_token) {
        // Send the ID token to your backend
        const response = await axios.post(`${API_BASE_URL}/api/auth/google`, {
          idToken: result.params.id_token,
        }, {
          headers: this.getAuthHeaders(),
        });
        
        const authResponse: AuthResponse = response.data;
        await this.storeAuthData(authResponse);
        return authResponse;
      } else {
        throw new Error('Google authentication was cancelled or failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Google login failed');
      }
      throw new Error('Network error during Google login');
    }
  }

  // Verify Token
  public async verifyToken(): Promise<boolean> {
    try {
      if (!this.authToken) return false;
      
      const response = await axios.get(`${API_BASE_URL}/api/auth/verify-token`, {
        headers: this.getAuthHeaders(),
      });
      
      return response.data.valid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  // Get User Profile
  public async getProfile(): Promise<User> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
        headers: this.getAuthHeaders(),
      });
      
      const user = response.data.user;
      this.currentUser = user;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Failed to fetch profile');
      }
      throw new Error('Network error fetching profile');
    }
  }

  // Update User Profile
  public async updateProfile(updates: { name?: string; email?: string }): Promise<User> {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/auth/profile`, updates, {
        headers: this.getAuthHeaders(),
      });
      
      const user = response.data.user;
      this.currentUser = user;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Failed to update profile');
      }
      throw new Error('Network error updating profile');
    }
  }

  // Logout
  public async logout(): Promise<void> {
    try {
      // Call logout endpoint if we have a token
      if (this.authToken) {
        try {
          await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
            headers: this.getAuthHeaders(),
          });
        } catch (error) {
          console.error('Error calling logout endpoint:', error);
        }
      }
      
      // Clear local storage
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      this.authToken = null;
      this.currentUser = null;
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  // Get current user
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return this.authToken !== null && this.currentUser !== null;
  }

  // Get auth token
  public getAuthToken(): string | null {
    return this.authToken;
  }

  // Get authenticated axios instance
  public getAuthenticatedAxios() {
    return axios.create({
      baseURL: API_BASE_URL,
      headers: this.getAuthHeaders(),
    });
  }
}

export default AuthService; 