import React, { useState, useCallback, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, FlatList, RefreshControl } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatInTimeZone } from 'date-fns-tz';
import { AuthContext } from '../context/AuthContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function HomeScreen({ navigation }) {
    const [residentProfile, setResidentProfile] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { signOut, socket } = useContext(AuthContext);

    const hasUnreadNotifications = notifications.some(notif => notif.is_read === 0);

    const fetchInitialData = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const headers = { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };
            const [profileRes, notificationsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/resident/me`, { headers }),
                axios.get(`${API_BASE_URL}/api/resident/notifications`, { headers })
            ]);
            setResidentProfile(profileRes.data);
            setNotifications(notificationsRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsRefreshing(false);
        }
    };
    
    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        fetchInitialData();
    }, []);

    const handleMarkAsRead = async () => {
        try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.post(`${API_BASE_URL}/api/resident/notifications/mark-as-read`, {}, {
                headers: { 'Authorization': `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
            });
            fetchInitialData();
            setModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'Could not mark notifications as read.');
        }
    };

    const handleLogout = () => {
        signOut();
    };



    const handleSosPress = () => {
    if (socket && residentProfile && residentProfile.phone_number) {
        socket.emit('resident_sos', { 
            flat_number: residentProfile.flat_number, 
            phone_number: residentProfile.phone_number
        });
        Alert.alert("SOS Sent!", "An emergency alert has been sent to the guard.");
    } else {
        Alert.alert("Error", "Could not send SOS. Profile data might be missing or is still loading. Please try again in a moment.");
    }
};

    useFocusEffect(useCallback(() => { fetchInitialData(); }, []));

    useEffect(() => {
        if (socket) {
            socket.on('new_visitor_alert', (newAlertData) => {
                console.log('Real-time alert received!', newAlertData);
                fetchInitialData();
            });
            return () => { socket.off('new_visitor_alert'); };
        }
    }, [socket]);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ marginRight: 15 }}>
                    <Feather name="bell" size={24} color="black" />
                    {hasUnreadNotifications && <View style={styles.notificationDot} />}
                </TouchableOpacity>
            ),
        });
    }, [navigation, hasUnreadNotifications]);

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Alerts</Text>
                        <FlatList
                            data={notifications.filter(n => n.is_read === 0)}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.notificationItem}>
                                    <Text style={styles.notificationText}>Visitor Contact: {item.visitor_phone_number}</Text>
                                    <Text style={styles.notificationText}>PIN: {item.pin_code}</Text>
                                    <Text style={styles.notificationTime}>{formatInTimeZone(new Date(item.entry_time), 'Asia/Kolkata', "h:mm a")}</Text>
                                </View>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No new alerts.</Text>}
                        />
                        {hasUnreadNotifications && (
                            <TouchableOpacity style={styles.markAsReadButton} onPress={handleMarkAsRead}>
                                <Text style={styles.markAsReadText}>Mark all as read</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            <View style={styles.header}>
                <Text style={styles.title}>ApnaGate</Text>
                <Text style={styles.welcomeMessage}>Welcome, {residentProfile ? residentProfile.name.split(' ')[0] : ''}</Text>
            </View>

            <View style={styles.grid}>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ManageVehicles')}>
                    <MaterialCommunityIcons name="car-multiple" size={40} color="#fff" />
                    <Text style={styles.cardText}>Manage Vehicles</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VisitorHistory')}>
                    <MaterialCommunityIcons name="history" size={40} color="#fff" />
                    <Text style={styles.cardText}>Visitor History</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.card} onPress={() => Alert.alert("Coming Soon!", "This feature is under development.")}>
                    <MaterialCommunityIcons name="shield-check-outline" size={40} color="#fff" />
                    <Text style={styles.cardText}>Pre-Approve Visitor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.card, styles.sosCard]} onPress={handleSosPress}>
                    <MaterialCommunityIcons name="alarm-light" size={40} color="#fff" />
                    <Text style={styles.cardText}>Emergency SOS</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert("Logout", "Are you sure?", [{ text: "Cancel" }, { text: "OK", onPress: handleLogout }])}>
                <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    header: { padding: 20, paddingTop: 40, backgroundColor: '#fff', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, },
    title: { fontSize: 32, fontWeight: 'bold', color: '#333' },
    welcomeMessage: { fontSize: 18, color: 'gray', marginTop: 5 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', padding: 10, marginTop: 10, },
    card: { width: '45%', aspectRatio: 1, backgroundColor: '#007bff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', margin: 8, elevation: 5, },
    sosCard: { backgroundColor: '#c0392b' },
    cardText: { color: 'white', marginTop: 10, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    logoutButton: { backgroundColor: '#ffdde1', marginHorizontal: 20, marginVertical: 30, padding: 15, borderRadius: 15, alignItems: 'center', elevation: 3 },
    logoutButtonText: { color: '#d32f2f', fontSize: 18, fontWeight: 'bold' },
    notificationDot: { position: 'absolute', right: -3, top: -3, backgroundColor: 'red', width: 10, height: 10, borderRadius: 5, },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', },
    modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 20, width: '85%', maxHeight: '60%', },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, },
    notificationItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee', },
    notificationText: { fontSize: 16, marginBottom: 5 },
    notificationTime: { color: 'gray', fontSize: 12, marginTop: 4 },
    emptyText: { textAlign: 'center', padding: 20 },
    markAsReadButton: { marginTop: 20, alignSelf: 'center', },
    markAsReadText: { color: 'gray', fontSize: 14, },
});