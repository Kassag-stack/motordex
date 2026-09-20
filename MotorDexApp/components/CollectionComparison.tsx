import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
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

interface ComparisonData {
  user: {
    id: string;
    name: string;
    stats: {
      totalVehicles: number;
      uniqueMakes: number;
      lastUpdated?: string;
    };
    uniqueVehicles: number;
  };
  friend: {
    id: string;
    name: string;
    stats: {
      totalVehicles: number;
      uniqueMakes: number;
      lastUpdated?: string;
    };
    uniqueVehicles: number;
  };
  commonVehicles: number;
  totalUniqueVehicles: number;
  details: {
    common: Array<{
      make: string;
      model: string;
      fullModel: string;
      userVehicle: CollectedVehicle;
      friendVehicle: CollectedVehicle;
      spottedFirstBy: 'user' | 'friend';
      timeDifference: number;
    }>;
    userOnly: CollectedVehicle[];
    friendOnly: CollectedVehicle[];
  };
}

interface CollectionComparisonProps {
  friendId: string;
  friendName: string;
  onBack: () => void;
}

export default function CollectionComparison({ friendId, friendName, onBack }: CollectionComparisonProps) {
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'common' | 'unique'>('overview');

  useEffect(() => {
    loadComparison();
  }, [friendId]);

  const loadComparison = async () => {
    try {
      setIsLoading(true);
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      const response = await axios.get(`/api/friends/${friendId}/compare`);
      setComparison(response.data.comparison);
    } catch (error) {
      console.error('Error loading comparison:', error);
      Alert.alert('Error', 'Failed to load collection comparison');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeDifference = (timeDiff: number): string => {
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Same day!';
    if (days === 1) return '1 day apart';
    if (days < 30) return `${days} days apart`;
    if (days < 365) return `${Math.floor(days / 30)} months apart`;
    return `${Math.floor(days / 365)} years apart`;
  };

  const renderOverviewTab = () => {
    if (!comparison) return null;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Stats Comparison */}
        <View style={styles.statsComparison}>
          <Text style={styles.sectionTitle}>Collection Overview</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>You</Text>
              <Text style={styles.statNumber}>{comparison.user.stats.totalVehicles}</Text>
              <Text style={styles.statDesc}>Total Cars</Text>
            </View>
            
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{comparison.friend.name}</Text>
              <Text style={styles.statNumber}>{comparison.friend.stats.totalVehicles}</Text>
              <Text style={styles.statDesc}>Total Cars</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{comparison.user.stats.uniqueMakes}</Text>
              <Text style={styles.statDesc}>Unique Makes</Text>
            </View>
            
            <View style={styles.vsContainer}>
              <Ionicons name="car-sport" size={24} color="#3B82F6" />
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{comparison.friend.stats.uniqueMakes}</Text>
              <Text style={styles.statDesc}>Unique Makes</Text>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Comparison Summary</Text>
          
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="repeat" size={32} color="#10B981" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryNumber}>{comparison.commonVehicles}</Text>
              <Text style={styles.summaryLabel}>Cars in Common</Text>
              <Text style={styles.summaryDesc}>
                {comparison.commonVehicles === 0 
                  ? "No shared vehicles yet!" 
                  : "You both have great taste!"}
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="person" size={32} color="#3B82F6" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryNumber}>{comparison.user.uniqueVehicles}</Text>
              <Text style={styles.summaryLabel}>Your Unique Cars</Text>
              <Text style={styles.summaryDesc}>
                Cars only you have spotted
              </Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="people" size={32} color="#F59E0B" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryNumber}>{comparison.friend.uniqueVehicles}</Text>
              <Text style={styles.summaryLabel}>{comparison.friend.name}'s Unique</Text>
              <Text style={styles.summaryDesc}>
                Cars only {comparison.friend.name} has spotted
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
          
          <View style={styles.insightCard}>
            <Ionicons name="trophy" size={24} color="#F59E0B" />
            <Text style={styles.insightText}>
              {comparison.user.stats.totalVehicles > comparison.friend.stats.totalVehicles 
                ? `You have ${comparison.user.stats.totalVehicles - comparison.friend.stats.totalVehicles} more cars!`
                : comparison.friend.stats.totalVehicles > comparison.user.stats.totalVehicles
                ? `${comparison.friend.name} has ${comparison.friend.stats.totalVehicles - comparison.user.stats.totalVehicles} more cars!`
                : "You're tied for total cars!"}
            </Text>
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="analytics" size={24} color="#8B5CF6" />
            <Text style={styles.insightText}>
              Together you've spotted {comparison.totalUniqueVehicles} unique vehicles!
            </Text>
          </View>

          {comparison.commonVehicles > 0 && (
            <View style={styles.insightCard}>
              <Ionicons name="time" size={24} color="#10B981" />
              <Text style={styles.insightText}>
                You share {comparison.commonVehicles} vehicles - check who spotted them first!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderCommonTab = () => {
    if (!comparison) return null;

    const commonVehicles = comparison.details.common;

    if (commonVehicles.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>No Common Vehicles</Text>
          <Text style={styles.emptySubtitle}>
            You and {comparison.friend.name} haven't spotted any of the same cars yet.
            Keep exploring to find some shared discoveries!
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>
          Shared Vehicles ({commonVehicles.length})
        </Text>
        
        {commonVehicles.map((item, index) => (
          <View key={index} style={styles.commonVehicleCard}>
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleMake}>{item.make}</Text>
                <Text style={styles.vehicleModel}>{item.model}</Text>
              </View>
              
              <View style={styles.winnerBadge}>
                <Ionicons 
                  name="trophy" 
                  size={16} 
                  color={item.spottedFirstBy === 'user' ? "#F59E0B" : "#10B981"} 
                />
                <Text style={[
                  styles.winnerText,
                  { color: item.spottedFirstBy === 'user' ? "#F59E0B" : "#10B981" }
                ]}>
                  {item.spottedFirstBy === 'user' ? 'You first!' : `${comparison.friend.name} first!`}
                </Text>
              </View>
            </View>

            <View style={styles.timeComparison}>
              <View style={styles.timeCard}>
                <Text style={styles.timeLabel}>You spotted</Text>
                <Text style={styles.timeDate}>
                  {new Date(item.userVehicle.dateSpotted).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.timeDifference}>
                <Text style={styles.timeDiffText}>
                  {formatTimeDifference(item.timeDifference)}
                </Text>
              </View>
              
              <View style={styles.timeCard}>
                <Text style={styles.timeLabel}>{comparison.friend.name} spotted</Text>
                <Text style={styles.timeDate}>
                  {new Date(item.friendVehicle.dateSpotted).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <View style={styles.imageComparison}>
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: item.userVehicle.imageUri }} 
                  style={styles.comparisonImage}
                  resizeMode="cover"
                />
                <Text style={styles.imageLabel}>Your Photo</Text>
              </View>
              
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: item.friendVehicle.imageUri }} 
                  style={styles.comparisonImage}
                  resizeMode="cover"
                />
                <Text style={styles.imageLabel}>{comparison.friend.name}'s Photo</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderUniqueTab = () => {
    if (!comparison) return null;

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* User's Unique Vehicles */}
        <View style={styles.uniqueSection}>
          <Text style={styles.sectionTitle}>
            Your Unique Cars ({comparison.details.userOnly.length})
          </Text>
          
          {comparison.details.userOnly.length === 0 ? (
            <Text style={styles.noUniqueText}>
              All your cars have been spotted by {comparison.friend.name} too!
            </Text>
          ) : (
            <View style={styles.vehicleGrid}>
              {comparison.details.userOnly.map((vehicle) => (
                <View key={vehicle.id} style={styles.uniqueVehicleCard}>
                  <Image 
                    source={{ uri: vehicle.imageUri }} 
                    style={styles.uniqueImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.uniqueMake}>{vehicle.make}</Text>
                  <Text style={styles.uniqueModel}>{vehicle.model}</Text>
                  <Text style={styles.uniqueDate}>
                    {new Date(vehicle.dateSpotted).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Friend's Unique Vehicles */}
        <View style={styles.uniqueSection}>
          <Text style={styles.sectionTitle}>
            {comparison.friend.name}'s Unique Cars ({comparison.details.friendOnly.length})
          </Text>
          
          {comparison.details.friendOnly.length === 0 ? (
            <Text style={styles.noUniqueText}>
              {comparison.friend.name} hasn't spotted any cars you haven't!
            </Text>
          ) : (
            <View style={styles.vehicleGrid}>
              {comparison.details.friendOnly.map((vehicle) => (
                <View key={vehicle.id} style={styles.uniqueVehicleCard}>
                  <Image 
                    source={{ uri: vehicle.imageUri }} 
                    style={styles.uniqueImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.uniqueMake}>{vehicle.make}</Text>
                  <Text style={styles.uniqueModel}>{vehicle.model}</Text>
                  <Text style={styles.uniqueDate}>
                    {new Date(vehicle.dateSpotted).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Comparing Collections...</Text>
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
          <Text style={styles.headerTitle}>COLLECTION COMPARISON</Text>
          <Text style={styles.headerSubtitle}>You vs {friendName}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Ionicons 
            name={activeTab === 'overview' ? "analytics" : "analytics-outline"} 
            size={20} 
            color={activeTab === 'overview' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'common' && styles.activeTab]}
          onPress={() => setActiveTab('common')}
        >
          <Ionicons 
            name={activeTab === 'common' ? "repeat" : "repeat-outline"} 
            size={20} 
            color={activeTab === 'common' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'common' && styles.activeTabText]}>
            Common
          </Text>
          {comparison && comparison.commonVehicles > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{comparison.commonVehicles}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'unique' && styles.activeTab]}
          onPress={() => setActiveTab('unique')}
        >
          <Ionicons 
            name={activeTab === 'unique' ? "star" : "star-outline"} 
            size={20} 
            color={activeTab === 'unique' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'unique' && styles.activeTabText]}>
            Unique
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'common' && renderCommonTab()}
      {activeTab === 'unique' && renderUniqueTab()}
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

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#161B22',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  activeTab: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B949E',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#3B82F6',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 16,
  },

  // Stats Comparison
  statsComparison: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#21262D',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B949E',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#3B82F6',
    marginBottom: 2,
  },
  statDesc: {
    fontSize: 12,
    color: '#8B949E',
  },
  vsContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B949E',
  },

  // Summary
  summarySection: {
    marginBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  summaryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F0F6FF',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 2,
  },
  summaryDesc: {
    fontSize: 14,
    color: '#8B949E',
  },

  // Insights
  insightsSection: {
    marginBottom: 24,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  insightText: {
    fontSize: 14,
    color: '#F0F6FF',
    marginLeft: 12,
    flex: 1,
  },

  // Common Vehicles
  commonVehicleCard: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleMake: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 2,
  },
  vehicleModel: {
    fontSize: 14,
    color: '#3B82F6',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  winnerText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  timeComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeCard: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#8B949E',
    marginBottom: 4,
  },
  timeDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F0F6FF',
  },
  timeDifference: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 12,
  },
  timeDiffText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  imageComparison: {
    flexDirection: 'row',
    gap: 12,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B949E',
  },

  // Unique Vehicles
  uniqueSection: {
    marginBottom: 32,
  },
  noUniqueText: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uniqueVehicleCard: {
    width: '48%',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  uniqueImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  uniqueMake: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 2,
  },
  uniqueModel: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 4,
  },
  uniqueDate: {
    fontSize: 10,
    color: '#8B949E',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 