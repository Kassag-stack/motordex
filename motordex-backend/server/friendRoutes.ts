import express, { Request, Response } from 'express';
import { authenticateToken, UserDB, FriendDB, CollectionDB, PublicUser } from './auth';

const router = express.Router();

// Search users by name or email
router.get('/users/search', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const users = UserDB.getUsers();
    const searchQuery = query.toLowerCase();
    
    // Filter users (exclude current user and include only name/email matches)
    const matchedUsers = users
      .filter(user => user.id !== req.user!.id)
      .filter(user => 
        user.name.toLowerCase().includes(searchQuery) ||
        user.email.toLowerCase().includes(searchQuery)
      )
      .map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt
      } as PublicUser))
      .slice(0, 20); // Limit results

    res.json({
      success: true,
      users: matchedUsers
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/friends/request', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    if (userId === req.user.id) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }

    // Check if target user exists
    const targetUser = UserDB.findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if already friends
    if (FriendDB.areFriends(req.user.id, userId)) {
      res.status(409).json({ error: 'Already friends with this user' });
      return;
    }

    try {
      const friendRequest = FriendDB.createFriendRequest(req.user.id, userId);
      
      res.status(201).json({
        success: true,
        message: `Friend request sent to ${targetUser.name}`,
        request: friendRequest
      });
    } catch (error: any) {
      if (error.message === 'Friend request already exists') {
        res.status(409).json({ error: 'Friend request already sent' });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending friend requests (received)
router.get('/friends/requests/pending', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const pendingRequests = FriendDB.getPendingRequests(req.user.id);
    
    // Get user details for each request
    const requestsWithUserInfo = pendingRequests.map(request => {
      const fromUser = UserDB.findUserById(request.fromUserId);
      return {
        ...request,
        fromUser: fromUser ? {
          id: fromUser.id,
          name: fromUser.name,
          email: fromUser.email,
          profilePicture: fromUser.profilePicture
        } : null
      };
    });

    res.json({
      success: true,
      requests: requestsWithUserInfo
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/friends/requests/:requestId/accept', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { requestId } = req.params;
    
    // Verify the request belongs to current user
    const requests = FriendDB.getFriendRequests();
    const request = requests.find(r => r.id === requestId && r.toUserId === req.user!.id);
    
    if (!request) {
      res.status(404).json({ error: 'Friend request not found' });
      return;
    }

    const friendship = FriendDB.acceptFriendRequest(requestId);
    
    if (!friendship) {
      res.status(400).json({ error: 'Failed to accept friend request' });
      return;
    }

    const friendUser = UserDB.findUserById(request.fromUserId);
    
    res.json({
      success: true,
      message: `You are now friends with ${friendUser?.name || 'this user'}`,
      friendship
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject friend request
router.post('/friends/requests/:requestId/reject', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { requestId } = req.params;
    
    // Verify the request belongs to current user
    const requests = FriendDB.getFriendRequests();
    const request = requests.find(r => r.id === requestId && r.toUserId === req.user!.id);
    
    if (!request) {
      res.status(404).json({ error: 'Friend request not found' });
      return;
    }

    const success = FriendDB.rejectFriendRequest(requestId);
    
    if (!success) {
      res.status(400).json({ error: 'Failed to reject friend request' });
      return;
    }

    res.json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friends list
router.get('/friends', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const friendIds = FriendDB.getUserFriends(req.user.id);
    
    const friends = friendIds.map(friendId => {
      const user = UserDB.findUserById(friendId);
      if (!user) return null;
      
      const collectionStats = CollectionDB.getCollectionStats(friendId);
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        createdAt: user.createdAt,
        collectionStats
      };
    }).filter(Boolean);

    res.json({
      success: true,
      friends
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove friend
router.delete('/friends/:friendId', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { friendId } = req.params;
    
    if (!FriendDB.areFriends(req.user.id, friendId)) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }

    const success = FriendDB.removeFriendship(req.user.id, friendId);
    
    if (!success) {
      res.status(400).json({ error: 'Failed to remove friend' });
      return;
    }

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friend's collection
router.get('/friends/:friendId/collection', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { friendId } = req.params;
    
    // Verify friendship
    if (!FriendDB.areFriends(req.user.id, friendId)) {
      res.status(403).json({ error: 'You can only view collections of your friends' });
      return;
    }

    const friend = UserDB.findUserById(friendId);
    if (!friend) {
      res.status(404).json({ error: 'Friend not found' });
      return;
    }

    const collection = CollectionDB.getUserCollection(friendId);
    const stats = CollectionDB.getCollectionStats(friendId);

    res.json({
      success: true,
      friend: {
        id: friend.id,
        name: friend.name,
        profilePicture: friend.profilePicture
      },
      collection,
      stats
    });
  } catch (error) {
    console.error('Error fetching friend collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compare collections with friend
router.get('/friends/:friendId/compare', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { friendId } = req.params;
    
    // Verify friendship
    if (!FriendDB.areFriends(req.user.id, friendId)) {
      res.status(403).json({ error: 'You can only compare with your friends' });
      return;
    }

    const friend = UserDB.findUserById(friendId);
    if (!friend) {
      res.status(404).json({ error: 'Friend not found' });
      return;
    }

    const userCollection = CollectionDB.getUserCollection(req.user.id);
    const friendCollection = CollectionDB.getUserCollection(friendId);
    
    // Find common vehicles (same make + model)
    const commonVehicles: any[] = [];
    const userOnlyVehicles: any[] = [];
    const friendOnlyVehicles: any[] = [];
    
    // Create maps for easier lookup
    const friendVehicleMap = new Map();
    friendCollection.forEach(vehicle => {
      friendVehicleMap.set(vehicle.fullModel, vehicle);
    });
    
    // Process user's collection
    userCollection.forEach(userVehicle => {
      const friendVehicle = friendVehicleMap.get(userVehicle.fullModel);
      
      if (friendVehicle) {
        // Common vehicle - determine who spotted first
        const userSpottedFirst = new Date(userVehicle.dateSpotted) < new Date(friendVehicle.dateSpotted);
        
        commonVehicles.push({
          make: userVehicle.make,
          model: userVehicle.model,
          fullModel: userVehicle.fullModel,
          userVehicle,
          friendVehicle,
          spottedFirstBy: userSpottedFirst ? 'user' : 'friend',
          timeDifference: Math.abs(
            new Date(userVehicle.dateSpotted).getTime() - 
            new Date(friendVehicle.dateSpotted).getTime()
          )
        });
        
        // Remove from friend map so we know what's left
        friendVehicleMap.delete(userVehicle.fullModel);
      } else {
        userOnlyVehicles.push(userVehicle);
      }
    });
    
    // Remaining vehicles are friend-only
    friendVehicleMap.forEach(vehicle => {
      friendOnlyVehicles.push(vehicle);
    });

    const userStats = CollectionDB.getCollectionStats(req.user.id);
    const friendStats = CollectionDB.getCollectionStats(friendId);

    res.json({
      success: true,
      comparison: {
        user: {
          id: req.user.id,
          name: req.user.name,
          stats: userStats,
          uniqueVehicles: userOnlyVehicles.length
        },
        friend: {
          id: friend.id,
          name: friend.name,
          stats: friendStats,
          uniqueVehicles: friendOnlyVehicles.length
        },
        commonVehicles: commonVehicles.length,
        totalUniqueVehicles: userOnlyVehicles.length + friendOnlyVehicles.length + commonVehicles.length,
        details: {
          common: commonVehicles,
          userOnly: userOnlyVehicles,
          friendOnly: friendOnlyVehicles
        }
      }
    });
  } catch (error) {
    console.error('Error comparing collections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 