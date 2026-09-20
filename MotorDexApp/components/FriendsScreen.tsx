import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/authService';

interface PublicUser {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  createdAt: string;
}

interface Friend extends PublicUser {
  collectionStats: {
    totalVehicles: number;
    uniqueMakes: number;
    lastUpdated?: string;
  };
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  fromUser?: PublicUser;
}

interface FriendsScreenProps {
  onBack: () => void;
  onViewCollection: (friendId: string, friendName: string) => void;
  onCompareCollection: (friendId: string, friendName: string) => void;
}

export default function FriendsScreen({ onBack, onViewCollection, onCompareCollection }: FriendsScreenProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
  }, []);

  const loadFriends = async () => {
    try {
      setIsLoading(true);
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      const response = await axios.get('/api/friends');
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      const response = await axios.get('/api/friends/requests/pending');
      setPendingRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      const response = await axios.get(`/api/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (userId: string, userName: string) => {
    try {
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      await axios.post('/api/friends/request', { userId });
      
      Alert.alert('Success', `Friend request sent to ${userName}!`);
      
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.id !== userId));
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send friend request';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const authService = AuthService.getInstance();
      const axios = authService.getAuthenticatedAxios();
      
      await axios.post(`/api/friends/requests/${requestId}/${action}`);
      
      Alert.alert('Success', `Friend request ${action}ed!`);
      
      // Reload data
      loadPendingRequests();
      if (action === 'accept') {
        loadFriends();
      }
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error);
      Alert.alert('Error', `Failed to ${action} friend request`);
    }
  };

  const removeFriend = async (friendId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const authService = AuthService.getInstance();
              const axios = authService.getAuthenticatedAxios();
              
              await axios.delete(`/api/friends/${friendId}`);
              
              Alert.alert('Success', `${friendName} removed from friends`);
              loadFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <Ionicons name="person" size={24} color="#3B82F6" />
        </View>
        
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendStats}>
            {item.collectionStats.totalVehicles} cars • {item.collectionStats.uniqueMakes} makes
          </Text>
        </View>
      </View>
      
      <View style={styles.friendActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onViewCollection(item.id, item.name)}
        >
          <Ionicons name="library-outline" size={16} color="#3B82F6" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onCompareCollection(item.id, item.name)}
        >
          <Ionicons name="analytics-outline" size={16} color="#10B981" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => removeFriend(item.id, item.name)}
        >
          <Ionicons name="person-remove-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: PublicUser }) => (
    <View style={styles.searchResultCard}>
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <Ionicons name="person" size={24} color="#3B82F6" />
        </View>
        
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendEmail}>{item.email}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.addFriendButton}
        onPress={() => sendFriendRequest(item.id, item.name)}
      >
        <Ionicons name="person-add" size={16} color="#FFFFFF" />
        <Text style={styles.addFriendText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPendingRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.friendInfo}>
        <View style={styles.friendAvatar}>
          <Ionicons name="person" size={24} color="#F59E0B" />
        </View>
        
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.fromUser?.name || 'Unknown User'}</Text>
          <Text style={styles.requestTime}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleFriendRequest(item.id, 'accept')}
        >
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleFriendRequest(item.id, 'reject')}
        >
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'friends':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>My Friends ({friends.length})</Text>
            {isLoading ? (
              <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
            ) : friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyTitle}>No Friends Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Search for users and send friend requests to start building your network!
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );

      case 'search':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Find Friends</Text>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#8B949E" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                placeholderTextColor="#8B949E"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
              />
            </View>

            {isSearching ? (
              <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
            ) : searchResults.length === 0 && searchQuery ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyTitle}>No Results</Text>
                <Text style={styles.emptySubtitle}>
                  No users found matching "{searchQuery}"
                </Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );

      case 'requests':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Friend Requests ({pendingRequests.length})</Text>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyTitle}>No Pending Requests</Text>
                <Text style={styles.emptySubtitle}>
                  You don't have any pending friend requests right now.
                </Text>
              </View>
            ) : (
              <FlatList
                data={pendingRequests}
                renderItem={renderPendingRequest}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#F0F6FF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>FRIENDS</Text>
          <Text style={styles.headerSubtitle}>Connect with fellow car enthusiasts</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons 
            name={activeTab === 'friends' ? "people" : "people-outline"} 
            size={20} 
            color={activeTab === 'friends' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Ionicons 
            name={activeTab === 'search' ? "search" : "search-outline"} 
            size={20} 
            color={activeTab === 'search' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons 
            name={activeTab === 'requests' ? "mail" : "mail-outline"} 
            size={20} 
            color={activeTab === 'requests' ? "#3B82F6" : "#8B949E"} 
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests
          </Text>
          {pendingRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {renderTabContent()}
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
    fontSize: 16,
    fontWeight: '700',
    color: '#F0F6FF',
    marginBottom: 16,
  },
  loader: {
    marginTop: 40,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#F0F6FF',
  },

  // Friend Cards
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0F6FF',
    marginBottom: 2,
  },
  friendStats: {
    fontSize: 14,
    color: '#8B949E',
  },
  friendEmail: {
    fontSize: 14,
    color: '#8B949E',
  },
  requestTime: {
    fontSize: 12,
    color: '#8B949E',
  },

  // Actions
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  addFriendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addFriendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty States
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