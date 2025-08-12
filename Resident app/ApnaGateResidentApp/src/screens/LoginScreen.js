import React, { useState, useContext } from 'react'; 
import { View, Text, Button, StyleSheet, TextInput, Alert, Platform } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { AuthContext } from '../context/AuthContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL; 

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

async function registerForPushNotificationsAsync(token) {
    let pushToken;
    if (!Device.isDevice) {
        alert('Push Notifications only work on physical devices.');
        return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        alert('You will not receive notifications for visitors.');
        return;
    }
    
    try {
        pushToken = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
        Alert.alert("Error Getting Push Token", e.message);
        return; // Stop if we can't get a token
    }
    
 
    if (pushToken) {
        try {
            await axios.post(`${API_BASE_URL}/api/resident/update-fcm-token`, 
                { fcm_token: pushToken },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'ngrok-skip-browser-warning': 'true'
                    }
                }
            );
            console.log("Successfully sent FCM token to server.");
        } catch (error) {
            Alert.alert(
                "FCM Token Send Error", 
                `Message: ${error.message}\n\nDetails: ${JSON.stringify(error.response?.data)}`
            );
            console.error("Failed to send FCM token to server", error);
        }
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }
    return pushToken;
}

export default function LoginScreen({ navigation }) {
    const [flatNumber, setFlatNumber] = useState('');
    const [password, setPassword] = useState('');
    
    const { signIn } = useContext(AuthContext);

    const handleLogin = async () => {
        if (!flatNumber || !password) {
            Alert.alert('Error', 'Please enter both flat number and password.');
            return;
        }

        try {
            const userToken = await signIn(flatNumber.toUpperCase(), password);

            if (userToken) {
                await registerForPushNotificationsAsync(userToken);
            }

        } catch (error) {
            Alert.alert('Login Failed', 'Please check your flat number and password.');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ApnaGate</Text>
            <TextInput
                style={styles.input}
                placeholder="Flat Number (e.g., B2-101)"
                value={flatNumber}
                onChangeText={setFlatNumber}
                autoCapitalize="characters"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title="Login" onPress={handleLogin} />
            <View style={styles.separator} />
            <Button
                title="New User? Register Here"
                onPress={() => navigation.navigate('Register')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
    title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
    input: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom: 15, fontSize: 16 },
    separator: { marginVertical: 10, }
});