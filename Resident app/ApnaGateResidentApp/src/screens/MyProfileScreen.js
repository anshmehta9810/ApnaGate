import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Image, TouchableOpacity } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MyProfileScreen() {
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await axios.get(`${API_BASE_URL}/api/resident/me`, {
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'ngrok-skip-browser-warning': 'true' 
                }
            });
            setProfile(response.data);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            Alert.alert('Error', 'Could not fetch your profile data.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        const token = await SecureStore.getItemAsync('userToken');
        const formData = new FormData();
        
        formData.append('profile_pic', {
            uri: uri,
            name: `photo_${Date.now()}.jpg`,
            type: 'image/jpeg',
        });

        try {
            await axios.post(`${API_BASE_URL}/api/resident/picture`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            Alert.alert('Success', 'Profile picture updated!');
            fetchProfile(); 
        } catch (error) {
            console.error("Image upload failed", error.response?.data);
            Alert.alert('Error', 'Failed to upload image.');
        }
    };

    const handleRemoveImage = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.delete(`${API_BASE_URL}/api/resident/picture`, {
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'ngrok-skip-browser-warning': 'true' 
                }
            });
            Alert.alert('Success', 'Profile picture removed.');
            fetchProfile();
        } catch (error) {
            Alert.alert('Error', 'Failed to remove image.');
        }
    };

    useFocusEffect(useCallback(() => { fetchProfile(); }, []));

    if (isLoading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    if (!profile) {
        return <View style={styles.center}><Text>Could not load profile.</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.profileCard}>
                <TouchableOpacity onPress={handlePickImage}>
                    {profile.profile_image_url ? (
                        <Image source={{ uri: `${API_BASE_URL}${profile.profile_image_url}` }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{profile.name ? profile.name.charAt(0).toUpperCase() : 'A'}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                
                <Text style={styles.name}>{profile.name}</Text>
                <Text style={styles.flatNumber}>{profile.flat_number}</Text>
                
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{profile.phone_number}</Text>
                </View>

                {profile.profile_image_url && (
                     <TouchableOpacity onPress={handleRemoveImage} style={styles.removeButton}>
                        <Text style={styles.removeButtonText}>Remove Picture</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        padding: 20,
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 20,
        borderWidth: 3,
        borderColor: '#007bff',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#007bff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarText: {
        fontSize: 60,
        color: 'white',
        fontWeight: 'bold',
    },
    name: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    flatNumber: {
        fontSize: 18,
        color: 'gray',
        marginBottom: 30,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    infoLabel: {
        fontSize: 16,
        color: '#333',
    },
    infoValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    removeButton: {
        marginTop: 20,
        backgroundColor: '#ffebee',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    removeButtonText: {
        color: '#d32f2f',
        fontWeight: 'bold',
    }
});