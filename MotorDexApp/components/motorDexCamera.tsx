import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VehicleCollection from './VehicleCollection';

// Replace with your backend URL (for Android emulator, use 10.0.2.2 instead of localhost)
const BACKEND_URL = 'http://10.0.2.2:3000';

const { width: screenWidth } = Dimensions.get('window');

interface DetectedText {
  locale?: string;
  description: string;
  boundingPoly: {
    vertices: Array<{ x: number; y: number }>;
  };
}

interface VehicleData {
  registrationNumber: string;
  year: string;
  make: string;
  model: string;
  bodystyle: string;
  color: string;
  engine: string;
  cylinders: string;
  gears: string;
  fuel_type: string;
  date_first_registered: string;
  mot_due_status: string;
  mot_due_ends: string;
  tax_due_status: string;
  tax_due_ends: string;
  power_bhp: string;
  power_kw: string;
  max_speed_mph: string;
  fuel_economy_combined: string;
  fuel_economy_extra_urban: string;
  fuel_economy_urban: string;
  co2_emission: string;
  ved_co2_band: string;
}

interface CollectedVehicle {
  id: string;
  make: string;
  model: string;
  imageUri: string;
  dateSpotted: string;
  fullModel: string; // For duplicate checking (make + model combined)
}

interface ApiResponse {
  text: DetectedText[];
  fullText?: string;
  message: string;
  hasText: boolean;
  licensePlates?: string[];
  vehicleData?: VehicleData;
}

export default function MotorDexCamera() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [detectedText, setDetectedText] = useState<DetectedText[]>([]);
  const [fullText, setFullText] = useState<string>('');
  const [licensePlates, setLicensePlates] = useState<string[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [collectionCount, setCollectionCount] = useState(0);
  const cameraRef = useRef<CameraView>(null);

  // Load collection count on mount
  React.useEffect(() => {
    loadCollectionCount();
  }, []);

  const loadCollectionCount = async () => {
    try {
      const storedCollection = await AsyncStorage.getItem('vehicleCollection');
      if (storedCollection) {
        const parsed = JSON.parse(storedCollection);
        setCollectionCount(parsed.length);
      }
    } catch (error) {
      console.error('Error loading collection count:', error);
    }
  };

  const saveToCollection = async (vehicle: VehicleData, imageUri: string) => {
    try {
      // Load existing collection
      const storedCollection = await AsyncStorage.getItem('vehicleCollection');
      let collection: CollectedVehicle[] = storedCollection ? JSON.parse(storedCollection) : [];
      
      // Check for duplicates (same make + model combination)
      const fullModel = `${vehicle.make} ${vehicle.model}`.toLowerCase();
      const isDuplicate = collection.some(item => item.fullModel === fullModel);
      
      if (isDuplicate) {
        Alert.alert(
          '🚗 Already Collected!',
          `${vehicle.make} ${vehicle.model} is already in your collection.`,
          [{ text: 'OK', style: 'default' }]
        );
        return false;
      }

      // Create new collection item
      const newVehicle: CollectedVehicle = {
        id: Date.now().toString(),
        make: vehicle.make,
        model: vehicle.model,
        imageUri: imageUri,
        dateSpotted: new Date().toISOString(),
        fullModel: fullModel,
      };

      // Add to collection
      collection.push(newVehicle);
      
      // Save back to storage
      await AsyncStorage.setItem('vehicleCollection', JSON.stringify(collection));
      
      // Update collection count
      setCollectionCount(collection.length);

      // Show success alert
      Alert.alert(
        '🎉 Vehicle Collected!',
        `${vehicle.make} ${vehicle.model} has been added to your collection!\n\nTotal vehicles: ${collection.length}`,
        [
          { text: 'View Collection', onPress: () => setShowCollection(true) },
          { text: 'Continue Scanning', style: 'default' }
        ]
      );
      
      return true;
    } catch (error) {
      console.error('Error saving to collection:', error);
      Alert.alert('Error', 'Failed to save vehicle to collection');
      return false;
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
        <View style={styles.permissionContainer}>
          <View style={styles.permissionCard}>
            <Ionicons name="camera" size={64} color="#3B82F6" />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionSubtitle}>
              MotorDex needs camera access to scan vehicle license plates
            </Text>
            <TouchableOpacity style={styles.premiumButton} onPress={requestPermission}>
              <Text style={styles.premiumButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show collection screen
  if (showCollection) {
    return <VehicleCollection onBack={() => setShowCollection(false)} />;
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setIsLoading(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: true,
        });
        
        if (photo) {
          setSelectedImageUri(photo.uri);
          await sendImageToBackend(photo.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsLoading(true);
        setSelectedImageUri(result.assets[0].uri);
        await sendImageToBackend(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsLoading(false);
    }
  };

  const sendImageToBackend = async (imageUri: string) => {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);

      const response = await axios.post(`${BACKEND_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response.data && response.data.hasText) {
        setDetectedText(response.data.text);
        setFullText(response.data.fullText || '');
        setLicensePlates(response.data.licensePlates || []);
        setVehicleData(response.data.vehicleData || null);
        
        if (response.data.licensePlates && response.data.licensePlates.length > 0) {
          if (response.data.vehicleData) {
            const vehicle = response.data.vehicleData;
            Alert.alert(
              `🚗 ${vehicle.make} ${vehicle.model}`, 
              `Vehicle identified successfully!`,
              [
                { text: 'Add to Collection', onPress: () => saveToCollection(vehicle, imageUri) },
                { text: 'Skip', style: 'cancel' }
              ]
            );
          } else {
            Alert.alert('🚗 Vehicle Detected', `License plate found but vehicle details not available`);
          }
        } else {
          const displayText = response.data.allText || response.data.fullText || '';
          Alert.alert('Success', `Text detected: "${displayText}"`);
        }
      } else {
        setDetectedText([]);
        setFullText('');
        setLicensePlates([]);
        setVehicleData(null);
        setSelectedImageUri(null);
        Alert.alert('No Text', response.data.message || 'No meaningful text was detected in the image');
      }
    } catch (error) {
      console.error('Error sending image to backend:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          Alert.alert('Connection Error', 'Cannot connect to the server. Make sure your backend is running on port 3000.');
        } else if (error.response) {
          Alert.alert('Server Error', `Server responded with: ${error.response.status}`);
        } else {
          Alert.alert('Network Error', 'Please check your internet connection');
        }
      } else {
        Alert.alert('Error', 'Failed to process image');
      }
    }
  };

  if (showCamera) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity 
              style={styles.cameraHeaderButton} 
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Scan License Plate</Text>
            <TouchableOpacity style={styles.cameraHeaderButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.scanFrame}>
            <View style={styles.scanCorner} />
            <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={takePicture}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={32} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <Text style={styles.brandTitle}>MOTORDEX</Text>
          <Text style={styles.heroTitle}>Professional Vehicle Scanner</Text>
          <Text style={styles.heroSubtitle}>
            Advanced AI-powered license plate recognition with instant vehicle identification
          </Text>
        </View>
        
        {/* Collection Button */}
        <TouchableOpacity 
          style={styles.collectionButton} 
          onPress={() => setShowCollection(true)}
        >
          <View style={styles.collectionButtonContent}>
            <Ionicons name="library" size={20} color="#3B82F6" />
            <Text style={styles.collectionButtonText}>My Collection</Text>
            {collectionCount > 0 && (
              <View style={styles.collectionBadge}>
                <Text style={styles.collectionBadgeText}>{collectionCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryAction]} 
            onPress={() => setShowCamera(true)}
            disabled={isLoading}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>SCAN WITH CAMERA</Text>
              <Text style={styles.actionButtonSubtext}>Real-time scanning</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryAction]} 
            onPress={pickImage}
            disabled={isLoading}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons name="image" size={24} color="#3B82F6" />
              <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>CHOOSE FROM GALLERY</Text>
              <Text style={[styles.actionButtonSubtext, { color: '#6B7280' }]}>Select existing photo</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Analyzing Vehicle...</Text>
            <Text style={styles.loadingSubtext}>AI processing in progress</Text>
          </View>
        )}

        {/* Results Section */}
        {vehicleData && licensePlates.length > 0 && (
          <View style={styles.resultsSection}>
            
            {/* Vehicle Card */}
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <Ionicons name="car-sport" size={32} color="#3B82F6" />
                <View style={styles.vehicleHeaderText}>
                  <Text style={styles.vehicleStatus}>VEHICLE COLLECTED</Text>
                </View>
              </View>
              
              <View style={styles.vehicleDetails}>
                <Text style={styles.vehicleMake}>{vehicleData.make}</Text>
                <Text style={styles.vehicleModel}>{vehicleData.model}</Text>
              </View>

              {selectedImageUri && (
                <View style={styles.vehicleImageContainer}>
                  <Image 
                    source={{ uri: selectedImageUri }} 
                    style={styles.vehicleImage}
                    resizeMode="cover"
                  />
                </View>
              )}
              
              {/* Add to Collection Button */}
              <TouchableOpacity 
                style={styles.addToCollectionButton}
                onPress={() => vehicleData && selectedImageUri && saveToCollection(vehicleData, selectedImageUri)}
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.addToCollectionText}>Add to Collection</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Feature Highlights */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Why Choose MotorDex</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={20} color="#F59E0B" />
              <Text style={styles.featureText}>Instant Recognition</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.featureText}>99.9% Accuracy</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="globe" size={20} color="#8B5CF6" />
              <Text style={styles.featureText}>Global Database</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  
  // Permission Screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionCard: {
    backgroundColor: '#161B22',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F0F6FF',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 16,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  
  // Hero Section
  heroSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    paddingTop: 60,
    backgroundColor: '#0D1117',
  },
  heroContent: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#3B82F6',
    letterSpacing: 3,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  
  // Collection Button
  collectionButton: {
    marginTop: 20,
    alignSelf: 'center',
  },
  collectionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  collectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 8,
  },
  collectionBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  collectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Content
  contentContainer: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  
  // Actions Section
  actionsSection: {
    padding: 20,
    gap: 16,
  },
  actionButton: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryAction: {
    backgroundColor: '#3B82F6',
  },
  secondaryAction: {
    backgroundColor: '#161B22',
    borderWidth: 2,
    borderColor: '#21262D',
  },
  actionButtonContent: {
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 1,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  
  // Premium Button
  premiumButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  
  // Loading
  loadingCard: {
    backgroundColor: '#161B22',
    margin: 20,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F0F6FF',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#8B949E',
    marginTop: 4,
  },
  
  // Results Section
  resultsSection: {
    padding: 20,
  },
  
  // Vehicle Card
  vehicleCard: {
    backgroundColor: '#161B22',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#21262D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleHeaderText: {
    marginLeft: 12,
  },
  vehicleStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
  },
  
  vehicleDetails: {
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleMake: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F0F6FF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  vehicleModel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3B82F6',
    textAlign: 'center',
    marginTop: 4,
  },
  
  // Vehicle Image
  vehicleImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  vehicleImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  
  // Add to Collection Button
  addToCollectionButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addToCollectionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  
  // Features Section
  featuresSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F0F6FF',
    marginLeft: 12,
  },
  
  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  cameraHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  
  // Scan Frame
  scanFrame: {
    position: 'absolute',
    top: '40%',
    left: '15%',
    right: '15%',
    height: 100,
    borderRadius: 12,
  },
  scanCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#3B82F6',
    borderRadius: 8,
  },
  scanCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderLeftWidth: 0,
  },
  scanCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopWidth: 0,
  },
  scanCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  
  // Camera Controls
  cameraControls: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
