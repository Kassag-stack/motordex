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

interface MainNavigatorProps {
  onLogout: () => void;
}

type TabType = 'camera' | 'collection' | 'profile';

const MainNavigator: React.FC<MainNavigatorProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('camera');

  const renderContent = () => {
    switch (activeTab) {
      case 'camera':
        return <MotorDexCamera />;
      case 'collection':
        return <VehicleCollection onBack={() => setActiveTab('camera')} />;
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
          {activeTab === 'profile' && 'Profile'}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'camera' && styles.navItemActive]}
          onPress={() => setActiveTab('camera')}
        >
          <Text style={[styles.navText, activeTab === 'camera' && styles.navTextActive]}>
            📸 Camera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'collection' && styles.navItemActive]}
          onPress={() => setActiveTab('collection')}
        >
          <Text style={[styles.navText, activeTab === 'collection' && styles.navTextActive]}>
            🚗 Collection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
            👤 Profile
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#e8f4ff',
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