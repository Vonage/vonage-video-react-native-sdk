import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export type TabName = 'session' | 'publisher' | 'subscriber' | 'moderation' | 'settings';

interface TabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

const TABS: { key: TabName; label: string; testID: string }[] = [
  { key: 'session', label: 'Session', testID: 'tabSession' },
  { key: 'publisher', label: 'Publisher', testID: 'tabPublisher' },
  { key: 'subscriber', label: 'Subscriber', testID: 'tabSubscriber' },
  { key: 'moderation', label: 'Moderation', testID: 'tabModeration' },
  { key: 'settings', label: 'Settings', testID: 'tabSettings' },
];

const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress }) => {
  return (
    <View style={tabBarStyles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            testID={tab.testID}
            style={[tabBarStyles.tabItem, isActive && tabBarStyles.tabItemActive]}
            onPress={() => onTabPress(tab.key)}
          >
            <Text
              style={[
                tabBarStyles.tabLabel,
                isActive && tabBarStyles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {isActive && <View style={tabBarStyles.tabIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabItemActive: {
    backgroundColor: '#f0f8ff',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#2196F3',
    borderRadius: 1.5,
  },
});

export default TabBar;
