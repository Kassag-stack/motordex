import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/authService';

interface CollectedVehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  imageUri: string;
  dateSpotted: string;
  fullModel: string;
  registrationNumber?: string;
  vehicleYear?: string;
  color?: string;
}

interface Friend {
  id: string;
  name: string;
  profilePicture?: string;
}

interface CollectionStats {
  totalVehicles: number;
  uniqueMakes: number;
  lastUpdated?: string;
}

interface FriendCollectionScreenProps {
  friendId: string;
  friendName: string;
  onBack: () => void;
  onCompare: (friendId: string, friendName: string) => void;
}

export default function FriendCollectionScreen({ friendId, friendName, onBack, onCompare }: FriendCollectionScreenProps) {
  const [collection, setCollection] = useState<CollectedVehicle[]>([]);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadFriendCollection();
  }, [friendId]);

  const loadFriendCollection = async () => {
    try {
      setIsLoading(true);
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      const response = await axios.get(`/api/friends/${friendId}/collection`);
      
      setCollection(response.data.collection || []);
      setFriend(response.data.friend);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading friend collection:', error);
      Alert.alert('Error', 'Failed to load friend\'s collection');
    } finally {
      setIsLoading(false);
    }
  };

  const renderVehicleGrid = ({ item }: { item: CollectedVehicle }) => (
    <View style={styles.gridItem}>
      <Image source={{ uri: item.imageUri }} style={styles.gridImage} resizeMode="cover" />
      <View style={styles.gridOverlay}>
        <Text style={styles.gridMake}>{item.make}</Text>
        <Text style={styles.gridModel}>{item.model}</Text>
        <Text style={styles.gridDate}>
          {new Date(item.dateSpotted).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const renderVehicleList = ({ item }: { item: CollectedVehicle }) => (
    <View style={styles.listItem}>
      <Image source={{ uri: item.imageUri }} style={styles.listImage} resizeMode="cover" />
      
      <View style={styles.listInfo}>
        <View style={styles.listHeader}>
          <Text style={styles.listMake}>{item.make}</Text>
          <Text style={styles.listModel}>{item.model}</Text>
        </View>
        
        <View style={styles.listDetails}>
          <Text style={styles.listDate}>
            Spotted: {new Date(item.dateSpotted).toLocaleDateString()}
          </Text>
          {item.vehicleYear && (
            <Text style={styles.listYear}>{item.vehicleYear}</Text>
          )}
          {item.color && (
            <Text style={styles.listColor}>{item.color}</Text>
          )}
        </View>
      </View>
    </View>
  );

  const getGridColumns = () => {
    return viewMode === 'grid' ? 2 : 1;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading {friendName}'s Collection...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#F0F6FF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{friendName.toUpperCase()}'S COLLECTION</Text>
          <Text style={styles.headerSubtitle}>
            {stats ? `${stats.totalVehicles} cars • ${stats.uniqueMakes} makes` : ''}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.compareButton}
          onPress={() => onCompare(friendId, friendName)}
        >
          <Ionicons name="analytics" size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="car-sport" size={20} color="#3B82F6" />
            <Text style={styles.statNumber}>{stats.totalVehicles}</Text>
            <Text style={styles.statLabel}>Total Cars</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Ionicons name="business" size={20} color="#10B981" />
            <Text style={styles.statNumber}>{stats.uniqueMakes}</Text>
            <Text style={styles.statLabel}>Unique Makes</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Ionicons name="time" size={20} color="#F59E0B" />
            <Text style={styles.statLabel}>Last Updated</Text>
            <Text style={styles.statDate}>
              {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>
      )}

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'grid' && styles.activeToggle]}
          onPress={() => setViewMode('grid')}
        >
          <Ionicons 
            name="grid" 
            size={16} 
            color={viewMode === 'grid' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.toggleText, viewMode === 'grid' && styles.activeToggleText]}>
            Grid
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.activeToggle]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={16} 
            color={viewMode === 'list' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.activeToggleText]}>
            List
          </Text>
        </TouchableOpacity>
      </View>

      {/* Collection */}
      {collection.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.friendAvatar}>
            <Ionicons name="person" size={48} color="#3B82F6" />
          </View>
          <Text style={styles.emptyTitle}>{friendName}'s Collection is Empty</Text>
          <Text style={styles.emptySubtitle}>
            {friendName} hasn't spotted any cars yet. Encourage them to start their car spotting journey!
          </Text>
        </View>
      ) : (
        <FlatList
          data={collection}
          renderItem={viewMode === 'grid' ? renderVehicleGrid : renderVehicleList}
          keyExtractor={(item) => item.id}
          numColumns={getGridColumns()}
          key={viewMode} // Force re-render when view mode changes
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Compare Button */}
      {collection.length > 0 && (
        <TouchableOpacity 
          style={styles.compareFloating}
          onPress={() => onCompare(friendId, friendName)}
        >
          <Ionicons name="analytics" size={24} color="#FFFFFF" />
          <Text style={styles.compareFloatingText}>Compare Collections</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8B949E',
    marginTop: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FF',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  compareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F0F6FF',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B949E',
    textAlign: 'center',
  },
  statDate: {
    fontSize: 10,
    color: '#8B949E',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#21262D',
    marginHorizontal: 16,
  },

  // View Toggle
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B949E',
    marginLeft: 6,
  },
  activeToggleText: {
    color: '#3B82F6',
  },

  // List
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Grid View
  gridItem: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridOverlay: {
    padding: 12,
  },
  gridMake: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 2,
  },
  gridModel: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 4,
  },
  gridDate: {
    fontSize: 10,
    color: '#8B949E',
  },

  // List View
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  listInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listHeader: {
    marginBottom: 8,
  },
  listMake: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 2,
  },
  listModel: {
    fontSize: 14,
    color: '#3B82F6',
  },
  listDetails: {
    gap: 2,
  },
  listDate: {
    fontSize: 12,
    color: '#8B949E',
  },
  listYear: {
    fontSize: 12,
    color: '#10B981',
  },
  listColor: {
    fontSize: 12,
    color: '#F59E0B',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  friendAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Floating Compare Button
  compareFloating: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  compareFloatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
}); 