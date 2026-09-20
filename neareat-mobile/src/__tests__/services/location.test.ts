/**
 * #430 — location.ts: OS cache-first fallback (getCurrentLocation) ve check-in
 * konumunda izin reddi / hata durumunda null'a düşme mantığı.
 */
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Low: 'low', Balanced: 'balanced' },
}));

import * as Location from 'expo-location';
import { requestLocationPermission, getCurrentLocation, getLocationForCheckin } from '../../services/location';

const mockedLocation = Location as jest.Mocked<typeof Location>;
beforeEach(() => jest.clearAllMocks());

describe('requestLocationPermission', () => {
  it('izin verilirse true döner', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as any);
    await expect(requestLocationPermission()).resolves.toBe(true);
  });

  it('izin reddedilirse false döner', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as any);
    await expect(requestLocationPermission()).resolves.toBe(false);
  });
});

describe('getCurrentLocation — OS cache-first', () => {
  it('cache’de son konum varsa GPS okumadan onu döner', async () => {
    mockedLocation.getLastKnownPositionAsync.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 } } as any);
    const result = await getCurrentLocation();
    expect(result).toEqual({ lat: 1, lng: 2 });
    expect(mockedLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('cache boşsa düşük doğrulukta GPS okur', async () => {
    mockedLocation.getLastKnownPositionAsync.mockResolvedValueOnce(null);
    mockedLocation.getCurrentPositionAsync.mockResolvedValueOnce({ coords: { latitude: 3, longitude: 4 } } as any);
    const result = await getCurrentLocation();
    expect(mockedLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 'low' });
    expect(result).toEqual({ lat: 3, lng: 4 });
  });
});

describe('getLocationForCheckin', () => {
  it('izin verilmezse null döner (check-in yine de yapılabilir, kanıtsız)', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as any);
    await expect(getLocationForCheckin()).resolves.toBeNull();
  });

  it('izin verilirse mocked bayrağını koruyarak Balanced doğrulukla okur', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as any);
    mockedLocation.getCurrentPositionAsync.mockResolvedValueOnce({ coords: { latitude: 1, longitude: 2 }, mocked: true } as any);

    const result = await getLocationForCheckin();

    expect(mockedLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 'balanced' });
    expect(result).toEqual({ lat: 1, lng: 2, mocked: true });
  });

  it('GPS okuma hata verirse (timeout vb.) null döner, throw etmez', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as any);
    mockedLocation.getCurrentPositionAsync.mockRejectedValueOnce(new Error('timeout'));

    await expect(getLocationForCheckin()).resolves.toBeNull();
  });
});
