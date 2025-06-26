import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CollectedVehicle {
  id: string;
  make: string;
  model: string;
  imageUri: string;
  dateSpotted: string;
  fullModel: string; // For duplicate checking (make + model combined)
}

interface VehicleCollectionProps {
  onBack: () => void;
}

export default function VehicleCollection({ onBack }: VehicleCollectionProps) {
  const [collection, setCollection] = useState<CollectedVehicle[]>([]);
  const [filteredCollection, setFilteredCollection] = useState<CollectedVehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [makes, setMakes] = useState<string[]>([]);

  useEffect(() => {
    loadCollection();
  }, []);

  useEffect(() => {
    // Extract unique makes for filtering
    const uniqueMakes = [...new Set(collection.map(vehicle => vehicle.make))].sort();
    setMakes(uniqueMakes);
  }, [collection]);

  useEffect(() => {
    // Filter collection based on search and selected make
    let filtered = collection;

    if (selectedMake) {
      filtered = filtered.filter(vehicle => vehicle.make === selectedMake);
    }

    if (searchQuery) {
      filtered = filtered.filter(vehicle => 
        vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredCollection(filtered);
  }, [collection, searchQuery, selectedMake]);

  const loadCollection = async () => {
    try {
      const storedCollection = await AsyncStorage.getItem('vehicleCollection');
      if (storedCollection) {
        const parsed = JSON.parse(storedCollection);
        setCollection(parsed);
        setFilteredCollection(parsed);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    }
  };

  const clearCollection = () => {
    Alert.alert(
      'Clear Collection',
      'Are you sure you want to clear your entire vehicle collection? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('vehicleCollection');
              setCollection([]);
              setFilteredCollection([]);
              setSelectedMake(null);
              setSearchQuery('');
            } catch (error) {
              console.error('Error clearing collection:', error);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderVehicleCard = ({ item }: { item: CollectedVehicle }) => (
    <View style={styles.vehicleCard}>
      <Image source={{ uri: item.imageUri }} style={styles.vehicleImage} resizeMode="cover" />
      
      <View style={styles.vehicleInfo}>
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleBadge}>
            <Ionicons name="car-sport" size={16} color="#3B82F6" />
            <Text style={styles.vehicleBadgeText}>COLLECTED</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.dateSpotted)}</Text>
        </View>
        
        <Text style={styles.vehicleMake}>{item.make}</Text>
        <Text style={styles.vehicleModel}>{item.model}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#F0F6FF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>MY COLLECTION</Text>
          <Text style={styles.headerSubtitle}>
            {collection.length} vehicle{collection.length !== 1 ? 's' : ''} discovered
          </Text>
        </View>
        
        <TouchableOpacity style={styles.clearButton} onPress={clearCollection}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{collection.length}</Text>
          <Text style={styles.statLabel}>Total Cars</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{makes.length}</Text>
          <Text style={styles.statLabel}>Unique Makes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {collection.length > 0 ? Math.round((makes.length / collection.length) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>Diversity</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8B949E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicles..."
            placeholderTextColor="#8B949E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.makeFilters}
          contentContainerStyle={styles.makeFiltersContent}
        >
          <TouchableOpacity
            style={[styles.makeFilter, !selectedMake && styles.makeFilterActive]}
            onPress={() => setSelectedMake(null)}
          >
            <Text style={[styles.makeFilterText, !selectedMake && styles.makeFilterActiveText]}>
              All
            </Text>
          </TouchableOpacity>
          
          {makes.map((make) => (
            <TouchableOpacity
              key={make}
              style={[styles.makeFilter, selectedMake === make && styles.makeFilterActive]}
              onPress={() => setSelectedMake(selectedMake === make ? null : make)}
            >
              <Text style={[
                styles.makeFilterText, 
                selectedMake === make && styles.makeFilterActiveText
              ]}>
                {make}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Collection List */}
      {filteredCollection.length === 0 ? (
        <View style={styles.emptyState}>
          {collection.length === 0 ? (
            <>
              <Ionicons name="car-outline" size={64} color="#6B7280" />
              <Text style={styles.emptyTitle}>Start Your Collection</Text>
              <Text style={styles.emptySubtitle}>
                Scan license plates to discover and collect vehicles!
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={64} color="#6B7280" />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search or filter criteria
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredCollection}
          renderItem={renderVehicleCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.collectionList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FF',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B949E',
    marginTop: 2,
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161B22',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8B949E',
    fontWeight: '600',
  },
  
  // Filter Section
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#F0F6FF',
  },
  makeFilters: {
    marginBottom: 0,
  },
  makeFiltersContent: {
    paddingRight: 20,
  },
  makeFilter: {
    backgroundColor: '#161B22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  makeFilterActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  makeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B949E',
  },
  makeFilterActiveText: {
    color: '#FFFFFF',
  },
  
  // Collection List
  collectionList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Vehicle Card
  vehicleCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#21262D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  vehicleImage: {
    width: '100%',
    height: 200,
  },
  vehicleInfo: {
    padding: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vehicleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    color: '#8B949E',
    fontWeight: '600',
  },
  vehicleMake: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F0F6FF',
    marginBottom: 4,
  },
  vehicleModel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F0F6FF',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 24,
  },
}); 