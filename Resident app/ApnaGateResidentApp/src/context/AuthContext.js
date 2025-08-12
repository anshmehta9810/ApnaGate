import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { io } from 'socket.io-client'; // Import socket.io-client

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [socket, setSocket] = useState(null); 

    const signIn = async (flatNumber, password) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/resident/login`, 
                { flat_number: flatNumber, password: password },
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );
            const token = response.data.token;
            setUserToken(token);
            await SecureStore.setItemAsync('userToken', token);
            return token;
        } catch (e) {
            console.log('Login error', e);
            throw new Error('Login failed');
        }
    };

    const signOut = async () => {
        if (socket) {
            socket.disconnect();
        }
        setUserToken(null);
        await SecureStore.deleteItemAsync('userToken');
    };

    useEffect(() => {
        if (userToken) {
            const newSocket = io(API_BASE_URL);
            setSocket(newSocket);

            newSocket.on('connect', () => {
                console.log('Connected to Socket.IO server!');
            });
        } else {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
        }

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [userToken]);


    useEffect(() => {
        const isLoggedIn = async () => {
            try {
                let token = await SecureStore.getItemAsync('userToken');
                setUserToken(token);
            } catch (e) {
                console.log(`isLoggedIn error: ${e}`);
            }
            setIsLoading(false);
        };
        isLoggedIn();
    }, []);

    return (
        <AuthContext.Provider value={{ signIn, signOut, userToken, isLoading, socket }}>
            {children}
        </AuthContext.Provider>
    );
};