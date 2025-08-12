import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, FlatList, TouchableOpacity } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ManageVehiclesScreen({ navigation }) {
    const [vehicles, setVehicles] = useState([]);
    const [newVehicle, setNewVehicle] = useState('');
    
    const fetchVehicles = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await axios.get(`${API_BASE_URL}/api/resident/vehicles`, {
                headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            setVehicles(response.data);
        } catch (error) {
            console.error('Failed to fetch vehicles:', error);
            Alert.alert('Error', 'Could not fetch vehicles.');
        }
    };
    
    useFocusEffect(useCallback(() => { fetchVehicles(); }, []));

    const handleAddVehicle = async () => {
        if (!newVehicle) {
            Alert.alert('Error', 'Please enter a vehicle number.');
            return;
        };
        try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.post(
                `${API_BASE_URL}/api/resident/vehicles/add`,
                { vehicle_number: newVehicle },
                { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }
            );
            Alert.alert('Success', 'Vehicle added!');
            setNewVehicle('');
            fetchVehicles(); 
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to add vehicle.');
        }
    };

    const handleDeleteVehicle = async (vehicleId) => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.post(
                `${API_BASE_URL}/api/resident/vehicles/delete`,
                { vehicle_id: vehicleId },
                { headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } }
            );
            Alert.alert('Success', 'Vehicle deleted!');
            fetchVehicles();
        } catch (error) {
            Alert.alert('Error', 'Failed to delete vehicle.');
        }
    };

    return (
        <FlatList
            style={styles.container}
            data={vehicles}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={
                <Text style={styles.mainTitle}>Your Registered Vehicles</Text>
            }
            renderItem={({ item }) => (
                <View style={styles.vehicleItem}>
                    <Text style={styles.vehicleText}>{item.vehicle_number}</Text>
                    <TouchableOpacity onPress={() => 
                        Alert.alert('Delete Vehicle', 'Are you sure?', [
                            { text: 'Cancel' },
                            { text: 'OK', onPress: () => handleDeleteVehicle(item.id) }
                        ])
                    }>
                        <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>You have no registered vehicles.</Text>}
            ListFooterComponent={
                 <View style={styles.section}>
                    <Text style={styles.title}>Add New Vehicle</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="New Vehicle Number"
                        value={newVehicle}
                        onChangeText={setNewVehicle}
                        autoCapitalize="characters"
                    />
                    <Button title="Add Vehicle" onPress={handleAddVehicle} />
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', margin: 20 },
    vehicleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 8, elevation: 2 },
    vehicleText: { fontSize: 18 },
    deleteText: { fontSize: 16, color: '#d32f2f', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: 'gray' },
    section: { backgroundColor: 'white', borderRadius: 8, padding: 20, margin: 15, elevation: 3, marginTop: 20 },
    title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 16 },
});