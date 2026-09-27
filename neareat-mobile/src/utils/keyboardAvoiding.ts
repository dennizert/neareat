import { Platform } from 'react-native';
import type { KeyboardAvoidingViewProps } from 'react-native';

/**
 * `KeyboardAvoidingView` için ortak `behavior` değeri.
 *
 * ESKİDEN Android'de `undefined` veriliyordu ve bu DOĞRUYDU: AndroidManifest'te
 * `android:windowSoftInputMode="adjustResize"` tanımlı olduğu için klavye
 * açıldığında **pencerenin kendisi küçülüyor**, içerik kendiliğinden yukarı
 * kayıyordu. `KeyboardAvoidingView`'ın ayrıca bir şey yapmasına gerek yoktu.
 *
 * SDK 55'te edge-to-edge zorunlu hâle geldi (Android 16 gerekliliği) ve bu
 * varsayım çöktü: edge-to-edge modda pencere artık sistem çubuklarının VE
 * klavyenin altına kadar uzanıyor, `adjustResize` pencereyi küçültmüyor.
 * Sonuç: `behavior` verilmeyen her ekranda input ve gönder butonu klavyenin
 * altında kalıyor (yükseltme test turu, bulgu E6 — giriş ekranında ölçüldü:
 * şifre alanı ve "Giriş Yap" butonu tamamen görünmez oluyordu).
 *
 * `'padding'` her iki platformda da doğru davranış: kapsayıcıya klavye
 * yüksekliği kadar alt dolgu ekleyip içeriği yukarı itiyor.
 *
 * ⚠️ Bu sabiti kullanan bir ekrana `keyboardVerticalOffset` verirken dikkat:
 * o değer iOS'ta header yüksekliğini telafi etmek için kullanılıyordu,
 * Android'de aynı değer içeriği fazladan yukarı iter.
 */
export const KEYBOARD_BEHAVIOR: KeyboardAvoidingViewProps['behavior'] = 'padding';

/**
 * Header'ı olan ekranlarda klavye boşluğunu telafi eden dikey ofset.
 * iOS'ta gezinme başlığı `KeyboardAvoidingView`'ın dışında kaldığı için
 * telafi gerekiyor; Android'de başlık kapsayıcının içinde olduğundan 0.
 */
export const keyboardOffsetForHeader = (iosOffset: number): number =>
  Platform.OS === 'ios' ? iosOffset : 0;
