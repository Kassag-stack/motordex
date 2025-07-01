import express, { Request, Response } from 'express';
import { AuthUtils, UserDB, User, authenticateToken } from './auth';

const router = express.Router();

// Email/Password Registration
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
      return;
    }

    // Check if user already exists
    const existingUser = UserDB.findUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ 
        error: 'User with this email already exists' 
      });
      return;
    }

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(password);

    // Create user
    const newUser = UserDB.createUser({
      email,
      name,
      password: hashedPassword
    });

    // Generate JWT token
    const token = AuthUtils.generateJWT({
      userId: newUser.id,
      email: newUser.email
    });

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email/Password Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ 
        error: 'Email and password are required' 
      });
      return;
    }

    // Find user
    const user = UserDB.findUserByEmail(email);
    if (!user || !user.password) {
      res.status(401).json({ 
        error: 'Invalid email or password' 
      });
      return;
    }

    // Verify password
    const isPasswordValid = await AuthUtils.comparePassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ 
        error: 'Invalid email or password' 
      });
      return;
    }

    // Generate JWT token
    const token = AuthUtils.generateJWT({
      userId: user.id,
      email: user.email
    });

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth Login
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ 
        error: 'Google ID token is required' 
      });
      return;
    }

    // Verify Google token
    const googleUser = await AuthUtils.verifyGoogleToken(idToken);
    
    if (!googleUser || !googleUser.email) {
      res.status(400).json({ 
        error: 'Invalid Google token' 
      });
      return;
    }

    // Check if user exists by Google ID
    let user = UserDB.findUserByGoogleId(googleUser.sub);
    
    if (!user) {
      // Check if user exists by email (they might have registered with email/password first)
      user = UserDB.findUserByEmail(googleUser.email);
      
      if (user) {
        // Link Google account to existing user
        user = UserDB.updateUser(user.id, {
          googleId: googleUser.sub,
          profilePicture: googleUser.picture
        });
      } else {
        // Create new user
        user = UserDB.createUser({
          email: googleUser.email,
          name: googleUser.name || googleUser.email,
          googleId: googleUser.sub,
          profilePicture: googleUser.picture
        });
      }
    }

    if (!user) {
      res.status(500).json({ error: 'Failed to create or update user' });
      return;
    }

    // Generate JWT token
    const token = AuthUtils.generateJWT({
      userId: user.id,
      email: user.email
    });

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// Update user profile
router.put('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const { name, email } = req.body;
    const updateData: Partial<User> = {};

    if (name) updateData.name = name;
    if (email && email !== req.user.email) {
      // Check if new email is already taken
      const existingUser = UserDB.findUserByEmail(email);
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400).json({ 
          error: 'Email is already taken' 
        });
        return;
      }
      updateData.email = email;
    }

    const updatedUser = UserDB.updateUser(req.user.id, updateData);
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password (for email/password users only)
router.put('/change-password', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!req.user.password) {
      res.status(400).json({ 
        error: 'Password change not available for Google accounts' 
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ 
        error: 'New password must be at least 6 characters long' 
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await AuthUtils.comparePassword(
      currentPassword, 
      req.user.password
    );

    if (!isCurrentPasswordValid) {
      res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
      return;
    }

    // Hash new password
    const hashedNewPassword = await AuthUtils.hashPassword(newPassword);

    // Update password
    const updatedUser = UserDB.updateUser(req.user.id, {
      password: hashedNewPassword
    });

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal, but we can log it server-side)
router.post('/logout', authenticateToken, (req: Request, res: Response): void => {
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just confirm the logout
  console.log(`User ${req.user?.email} logged out`);
  res.json({ message: 'Logged out successfully' });
});

// Token verification endpoint
router.get('/verify-token', authenticateToken, (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ 
    valid: true,
    user: userWithoutPassword 
  });
});

export default router; 