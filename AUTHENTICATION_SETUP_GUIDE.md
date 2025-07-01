# MotorDex Authentication Setup Guide

## ✅ Dependencies Fixed

All authentication dependencies have been successfully installed and configured. Here's how to complete the setup:

## 🔧 Backend Configuration

### 1. Create Environment Variables

Create a `.env` file in the `motordex-backend/` directory with these variables:

```env
# Google Vision API Key (required for license plate OCR)
GOOGLE_API_KEY=your_google_vision_api_key_here

# Vehicle Database API Key (required for vehicle lookup)
VEHICLE_DB_API_KEY=your_vehicle_databases_api_key_here

# JWT Secret (required for authentication - use a strong, random string)
JWT_SECRET=supersecurejwtsecretkey123!@#$%^&*()

# Google OAuth Client ID (optional - only needed for Google authentication)
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here.apps.googleusercontent.com

# Server Port (optional - defaults to 3000)
PORT=3000
```

### 2. Generate a Strong JWT Secret

You can generate a secure JWT secret using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Or use an online generator: https://randomkeygen.com/

## 📱 Frontend Configuration

### 1. Update API URL

In `MotorDexApp/services/authService.ts`, update the `API_BASE_URL`:

**For iOS Simulator / Android Emulator:**
```typescript
const API_BASE_URL = 'http://10.0.2.2:3000'; // Special emulator IP
```

**For Physical Device:**
```typescript
const API_BASE_URL = 'http://YOUR_LOCAL_IP:3000'; // e.g., http://192.168.1.100:3000
```

To find your local IP:
- **Windows:** Run `ipconfig` in Command Prompt
- **Mac/Linux:** Run `ifconfig` or `ip addr show`

### 2. Google OAuth Setup (Optional)

If you want Google Sign-In functionality:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sign-In API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Select "Web Application"
6. Add authorized redirect URIs (Expo will show you the URI when you test)
7. Copy the Client ID and add it to:
   - Backend `.env` file as `GOOGLE_CLIENT_ID`
   - Frontend `authService.ts` as `GOOGLE_CLIENT_ID`

## 🚀 Running the Application

### 1. Start Backend Server

```bash
cd motordex-backend
npm start
```

You should see:
```
Server running on port 3000
Available endpoints:
  POST /upload - Upload image for license plate detection
  POST /vehicle-lookup - Direct vehicle lookup
  POST /api/auth/register - User registration
  POST /api/auth/login - User login
  POST /api/auth/google - Google OAuth login
  GET /api/auth/profile - Get user profile (requires auth)
  PUT /api/auth/profile - Update user profile (requires auth)
  Vehicle Databases API: Ready
  Authentication System: Ready
```

### 2. Start React Native App

```bash
cd MotorDexApp
npm start
```

## 🎯 Testing Authentication

### 1. Email/Password Registration
- Open the app
- You'll see the authentication screen
- Toggle to "Create Account"
- Enter name, email, and password
- Tap "Create Account"

### 2. Email/Password Login
- Use the credentials you created
- Tap "Sign In"

### 3. Google OAuth (if configured)
- Tap "Continue with Google"
- Complete the Google authentication flow

## 📱 App Navigation

Once authenticated, you'll see a tab-based interface:

1. **📸 Camera Tab** - Scan license plates (existing functionality)
2. **🚗 Collection Tab** - View your vehicle collection
3. **👤 Profile Tab** - View profile, settings, and logout

## 🔐 Security Features

- ✅ JWT tokens with 7-day expiration
- ✅ Secure password hashing with BCrypt
- ✅ Automatic token verification
- ✅ Secure storage using Expo SecureStore
- ✅ Protected API endpoints

## 🐛 Troubleshooting

### Common Issues:

1. **"Network Error" when logging in**
   - Check that backend server is running
   - Verify API_BASE_URL is correct
   - For physical devices, use your local IP address

2. **Google Sign-In not working**
   - Verify GOOGLE_CLIENT_ID is set correctly
   - Check that Google Sign-In API is enabled
   - Ensure redirect URIs are configured properly

3. **App crashes on startup**
   - Make sure all dependencies are installed: `npm install`
   - Try clearing Metro cache: `npx expo start --clear`

4. **"Invalid token" errors**
   - User will be automatically logged out
   - This is normal security behavior
   - User can log in again

### Debug Backend API

Test backend endpoints directly:

```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 📝 What's New

### Backend Features:
- Complete authentication API
- User registration and login
- Google OAuth integration
- JWT token management
- User profile management
- Password change functionality

### Frontend Features:
- Beautiful login/signup interface
- Google OAuth integration
- Secure token storage
- User profile screen
- Tab-based navigation
- Automatic auth state management

## 🎉 Ready to Use!

Your MotorDex app now has:
- ✅ User authentication working
- ✅ Secure session management
- ✅ Beautiful UI for auth flows
- ✅ Integration with existing camera features
- ✅ User profiles and settings

The authentication system is production-ready and follows security best practices! 