import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ChangePasswordScreen({ navigation }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword) {
            Alert.alert('Error', 'Please fill both password fields.');
            return;
        }
        try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.post(
                `${API_BASE_URL}/api/resident/change-password`,
                { old_password: oldPassword, new_password: newPassword },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'ngrok-skip-browser-warning': 'true'
                    }
                }
            );
            Alert.alert('Success', 'Your password has been changed successfully.');
            setOldPassword('');
            setNewPassword('');
            navigation.goBack();
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'Failed to change password.';
            Alert.alert('Error', errorMessage);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Change Your Password</Text>
            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="Old Password"
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry
                />
                <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                />
                <Button title="Update Password" onPress={handleChangePassword} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    form: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        elevation: 3,
    },
    input: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 20,
        fontSize: 16,
    },
});