import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

const TextComponent = ({ testID, children }) => {
  return (
    <View style={styles.container}>
      <Text testID={testID} style={styles.text}>
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 1
  },
  text: {
    fontSize: 13,
    color: '#2323d6',
  },
});

export default TextComponent;
