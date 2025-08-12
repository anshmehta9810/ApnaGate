import React, { useContext } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';

import { AuthProvider, AuthContext } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ManageVehiclesScreen from './src/screens/ManageVehiclesScreen';
import MyProfileScreen from './src/screens/MyProfileScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function MainAppDrawer() {
  return (
    <Drawer.Navigator initialRouteName="Home">
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'Home Dashboard' }}/>
      <Drawer.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'My Profile' }}/>
      <Drawer.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }}/>
      <Drawer.Screen name="VisitorHistory" component={HistoryScreen} options={{ title: 'Visitor History', drawerItemStyle: { display: 'none' } }}/>
      <Drawer.Screen name="ManageVehicles" component={ManageVehiclesScreen} options={{ title: 'Manage Vehicles', drawerItemStyle: { display: 'none' } }}/>
    </Drawer.Navigator>
  );
}

function AppNav() {
    const { userToken, isLoading } = useContext(AuthContext);
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }
    
    return (
        <NavigationContainer>
            <Stack.Navigator>
                {userToken == null ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'New Registration' }} />
                    </>
                ) : (
                    <Stack.Screen name="AppDrawer" component={MainAppDrawer} options={{ headerShown: false }} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppNav />
        </AuthProvider>
    );
}