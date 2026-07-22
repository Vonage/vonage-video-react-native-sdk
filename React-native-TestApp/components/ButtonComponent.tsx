import React from 'react';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';

const ButtonComponent = ({ testID, handleSubmit, label }) => {
  return (
    <TouchableOpacity style={styles.button} testID={testID} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#444545',
    padding: 8,
    borderRadius: 5,
    margin: 2,
    width: 107,
    height: 32
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
  }
});

export default ButtonComponent;
