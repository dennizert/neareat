import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LocationPermissionScreen from '../screens/onboarding/LocationPermissionScreen';
import LoginScreen from '../screens/onboarding/LoginScreen';
import RegisterScreen from '../screens/onboarding/RegisterScreen';
import PremiumIntroScreen from '../screens/onboarding/PremiumIntroScreen';
import ForgotPasswordScreen from '../screens/onboarding/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/onboarding/ResetPasswordScreen';
import EmailVerificationScreen from '../screens/onboarding/EmailVerificationScreen';

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PremiumIntro" component={PremiumIntroScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
    </Stack.Navigator>
  );
}
