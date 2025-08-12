import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL; 

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [password, setPassword] = useState('');
  const [vehicle, setVehicle] = useState('');

  const handleRegister = async () => {
    if (!name || !phone || !flatNumber || !password) {
      Alert.alert('Error', 'Please fill all required fields.');
      return;
    }

    const residentData = {
      name: name,
      phone_number: phone,
      flat_number: flatNumber.toUpperCase(),
      password: password,
      vehicles: vehicle ? [vehicle.toUpperCase()] : []
    };

    try {
      await axios.post(`${API_BASE_URL}/api/resident/register`, residentData, { headers: { 'ngrok-skip-browser-warning': 'true' } } 
);
      Alert.alert('Success', 'Registration successful! Please login.');
      navigation.navigate('Login');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', errorMessage);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Resident Registration</Text>
      
      <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="Flat Number (e.g., B2-101)" value={flatNumber} onChangeText={setFlatNumber} autoCapitalize="characters" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="Vehicle Number (Optional)" value={vehicle} onChangeText={setVehicle} autoCapitalize="characters" />
      
      <View style={styles.buttonContainer}>
        <Button title="Register" onPress={handleRegister} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 15,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 10,
  }
});