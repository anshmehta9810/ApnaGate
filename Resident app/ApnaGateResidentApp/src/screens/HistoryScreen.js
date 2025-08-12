import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';
import { formatInTimeZone } from 'date-fns-tz';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function HistoryScreen() {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await axios.get(`${API_BASE_URL}/api/resident/history`, {
                headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            setHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchHistory(); }, []));

    if (isLoading) {
        return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Visitor History</Text>
            <FlatList
                data={history}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardText}>Visitor Contact: {item.visitor_phone_number}</Text>
                        
                        {/* YAHAN PAR CHANGE KIYA GAYA HAI */}
                        <Text style={styles.cardText}>
                          Date: {formatInTimeZone(new Date(item.entry_time), 'Asia/Kolkata', "dd MMM yyyy, h:mm a")}
                        </Text>
                        
                        <View style={[styles.statusBadge, 
                            item.status === 'APPROVED' ? styles.approved : styles.denied
                        ]}>
                            <Text style={styles.statusText}>{item.status}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<View style={styles.center}><Text>No visitor history found.</Text></View>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
    card: { backgroundColor: 'white', borderRadius: 8, padding: 15, marginVertical: 8, marginHorizontal: 15, elevation: 3 },
    cardText: { fontSize: 16, marginBottom: 8 },
    statusBadge: { borderRadius: 15, paddingVertical: 5, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 10 },
    approved: { backgroundColor: '#c8e6c9' },
    denied: { backgroundColor: '#ffcdd2' },
    statusText: { fontSize: 14, fontWeight: 'bold' }
});