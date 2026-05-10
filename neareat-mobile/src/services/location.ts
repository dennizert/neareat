import * as Location from 'expo-location';
import { MOCK_MODE, MOCK_COORDS } from '../config';

export interface Coords {
  lat: number;
  lng: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (MOCK_MODE) return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Coords> {
  if (MOCK_MODE) return MOCK_COORDS;

  // Use last known position first — returns instantly from OS cache
  const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
  if (last) {
    return { lat: last.coords.latitude, lng: last.coords.longitude };
  }

  // Fall back to low accuracy (much faster than Balanced on cold start)
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  });
  return { lat: location.coords.latitude, lng: location.coords.longitude };
}
