import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MotorDexCamera from './motorDexCamera';
import VehicleCollection from './VehicleCollection';
import ProfileScreen from './ProfileScreen';
import FriendsScreen from './FriendsScreen';
import FriendCollectionScreen from './FriendCollectionScreen';
import CollectionComparison from './CollectionComparison';

interface MainNavigatorProps {
  onLogout: () => void;
}

type TabType = 'camera' | 'collection' | 'friends' | 'profile';

const MainNavigator: React.FC<MainNavigatorProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('camera');
  const [friendsSubScreen, setFriendsSubScreen] = useState<'main' | 'collection' | 'comparison'>('main');
  const [selectedFriend, setSelectedFriend] = useState<{id: string, name: string} | null>(null);

  const handleViewFriendCollection = (friendId: string, friendName: string) => {
    setSelectedFriend({id: friendId, name: friendName});
    setFriendsSubScreen('collection');
  };

  const handleCompareFriendCollection = (friendId: string, friendName: string) => {
    setSelectedFriend({id: friendId, name: friendName});
    setFriendsSubScreen('comparison');
  };

  const handleBackToFriends = () => {
    setFriendsSubScreen('main');
    setSelectedFriend(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'camera':
        return <MotorDexCamera />;
      case 'collection':
        return <VehicleCollection onBack={() => setActiveTab('camera')} />;
      case 'friends':
        if (friendsSubScreen === 'main') {
          return (
            <FriendsScreen 
              onBack={() => {}} // No back action needed on main tab
              onViewCollection={handleViewFriendCollection}
              onCompareCollection={handleCompareFriendCollection}
            />
          );
        } else if (friendsSubScreen === 'collection' && selectedFriend) {
          return (
            <FriendCollectionScreen
              friendId={selectedFriend.id}
              friendName={selectedFriend.name}
              onBack={handleBackToFriends}
              onCompare={handleCompareFriendCollection}
            />
          );
        } else if (friendsSubScreen === 'comparison' && selectedFriend) {
          return (
            <CollectionComparison
              friendId={selectedFriend.id}
              friendName={selectedFriend.name}
              onBack={handleBackToFriends}
            />
          );
        }
        return <FriendsScreen onBack={() => {}} onViewCollection={handleViewFriendCollection} onCompareCollection={handleCompareFriendCollection} />;
      case 'profile':
        return <ProfileScreen onLogout={onLogout} />;
      default:
        return <MotorDexCamera />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MotorDex</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'camera' && 'Scan License Plates'}
          {activeTab === 'collection' && 'Your Vehicles'}
          {activeTab === 'friends' && 'Connect with Car Enthusiasts'}
          {activeTab === 'profile' && 'Profile'}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Navigation - Only show when not in sub-screens */}
      {activeTab !== 'friends' || friendsSubScreen === 'main' ? (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'camera' && styles.navItemActive]}
            onPress={() => {
              setActiveTab('camera');
              setFriendsSubScreen('main');
              setSelectedFriend(null);
            }}
          >
            <Text style={[styles.navText, activeTab === 'camera' && styles.navTextActive]}>
              📸 Camera
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'collection' && styles.navItemActive]}
            onPress={() => {
              setActiveTab('collection');
              setFriendsSubScreen('main');
              setSelectedFriend(null);
            }}
          >
            <Text style={[styles.navText, activeTab === 'collection' && styles.navTextActive]}>
              🚗 Collection
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'friends' && styles.navItemActive]}
            onPress={() => {
              setActiveTab('friends');
              setFriendsSubScreen('main');
              setSelectedFriend(null);
            }}
          >
            <Text style={[styles.navText, activeTab === 'friends' && styles.navTextActive]}>
              👥 Friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
            onPress={() => {
              setActiveTab('profile');
              setFriendsSubScreen('main');
              setSelectedFriend(null);
            }}
          >
            <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
              👤 Profile
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e8f4ff',
    textAlign: 'center',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  navItemActive: {
    backgroundColor: '#e8f4ff',
    borderRadius: 8,
  },
  navText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  navTextActive: {
    color: '#007bff',
    fontWeight: '600',
  },
});

export default MainNavigator; 