import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import AppIcon from './AppIcon';
import type { IconName } from '../theme/icons';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState { message: string; type: ToastType; duration: number; key: number; }

export interface ToastApi {
  /** Kısa bildirim göster. Yıkıcı onaylar için Alert kullan; bu yalnızca bilgi/başarı/hata içindir. */
  show: (message: string, type?: ToastType, duration?: number) => void;
}

export const ToastContext = createContext<ToastApi>({ show: () => {} });

const DEFAULT_DURATION = 2500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();

  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback<ToastApi['show']>((message, type = 'info', duration = DEFAULT_DURATION) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, type, duration, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(hide, toast.duration);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [toast, anim, hide]);

  const palette: Record<ToastType, { bg: string; fg: string; icon: IconName }> = {
    success: { bg: C.successSurface, fg: C.success, icon: 'check' },
    error: { bg: C.errorSurface, fg: C.error, icon: 'reject' },
    info: { bg: C.primaryLighter, fg: C.primary, icon: 'info' },
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              bottom: insets.bottom + 24,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hide}
            style={[styles.toast, { backgroundColor: palette[toast.type].bg }]}
          >
            <AppIcon name={palette[toast.type].icon} size={18} color={palette[toast.type].fg} />
            <Text style={[styles.text, { color: palette[toast.type].fg }]} numberOfLines={2}>
              {toast.message}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
    toast: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
      maxWidth: 480, width: '100%',
      shadowColor: C.shadow, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    text: { flex: 1, fontSize: 14, fontWeight: '600' },
  });
}
