import express, { Request, Response } from 'express';
import { authenticateToken, CollectionDB, CollectedVehicle } from './auth';

const router = express.Router();

// Get user's vehicle collection
router.get('/collection', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const vehicles = CollectionDB.getUserCollection(req.user.id);
    const stats = CollectionDB.getCollectionStats(req.user.id);

    res.json({
      success: true,
      collection: vehicles,
      stats
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add vehicle to collection
router.post('/collection/add', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { make, model, imageUri, registrationNumber, vehicleYear, color } = req.body;

    if (!make || !model || !imageUri) {
      res.status(400).json({ 
        error: 'Make, model, and imageUri are required' 
      });
      return;
    }

    // Check for duplicates (same make + model combination)
    const existingVehicles = CollectionDB.getUserCollection(req.user.id);
    const fullModel = `${make} ${model}`.toLowerCase();
    const isDuplicate = existingVehicles.some(vehicle => vehicle.fullModel === fullModel);

    if (isDuplicate) {
      res.status(409).json({
        error: 'Vehicle already exists in collection',
        message: `${make} ${model} is already in your collection`
      });
      return;
    }

    const vehicleData: Omit<CollectedVehicle, 'userId'> = {
      id: Date.now().toString(),
      make,
      model,
      imageUri,
      dateSpotted: new Date().toISOString(),
      fullModel,
      registrationNumber,
      vehicleYear,
      color
    };

    const addedVehicle = CollectionDB.addVehicleToCollection(req.user.id, vehicleData);
    const stats = CollectionDB.getCollectionStats(req.user.id);

    res.status(201).json({
      success: true,
      vehicle: addedVehicle,
      stats,
      message: `${make} ${model} added to your collection!`
    });
  } catch (error) {
    console.error('Error adding vehicle to collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove vehicle from collection
router.delete('/collection/:vehicleId', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { vehicleId } = req.params;
    const removed = CollectionDB.removeVehicleFromCollection(req.user.id, vehicleId);

    if (!removed) {
      res.status(404).json({ 
        error: 'Vehicle not found in collection' 
      });
      return;
    }

    const stats = CollectionDB.getCollectionStats(req.user.id);

    res.json({
      success: true,
      message: 'Vehicle removed from collection',
      stats
    });
  } catch (error) {
    console.error('Error removing vehicle from collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear entire collection
router.delete('/collection', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    CollectionDB.clearUserCollection(req.user.id);

    res.json({
      success: true,
      message: 'Collection cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync collection (update with client data)
router.put('/collection/sync', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { vehicles } = req.body;

    if (!Array.isArray(vehicles)) {
      res.status(400).json({ 
        error: 'Vehicles must be an array' 
      });
      return;
    }

    // Validate vehicle data
    const validVehicles = vehicles.filter(vehicle => 
      vehicle.make && vehicle.model && vehicle.imageUri
    ).map(vehicle => ({
      ...vehicle,
      userId: req.user!.id,
      id: vehicle.id || Date.now().toString(),
      fullModel: `${vehicle.make} ${vehicle.model}`.toLowerCase(),
      dateSpotted: vehicle.dateSpotted || new Date().toISOString()
    }));

    CollectionDB.updateUserCollection(req.user.id, validVehicles);
    const stats = CollectionDB.getCollectionStats(req.user.id);

    res.json({
      success: true,
      message: 'Collection synced successfully',
      collection: validVehicles,
      stats
    });
  } catch (error) {
    console.error('Error syncing collection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get collection statistics
router.get('/collection/stats', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const stats = CollectionDB.getCollectionStats(req.user.id);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 