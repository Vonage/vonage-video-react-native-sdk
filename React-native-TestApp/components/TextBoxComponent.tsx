import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';

const TextBoxComponent = ({ testID, placeholder, value = '', onChangeText }) => {
  return (
    <TextInput
      testID={testID}
      placeholder={placeholder}
      placeholderTextColor='#a9a9a9'
      style={styles.input}
      onChangeText={onChangeText}
      value={value}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    width: 160,
    height: 40,
    borderWidth: 1,
    borderColor: '#a9b0b4',
    borderRadius: 5,
    marginBottom: 3,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
    borderBottomColor: 'red',
    borderBottomWidth: 2
  },
});

export default TextBoxComponent;
