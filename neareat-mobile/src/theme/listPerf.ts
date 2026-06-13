import { Platform } from 'react-native';

// Liste (FlatList) performans varsayılanları (S14-M4).
// Büyük listelerde render maliyetini ve bellek kullanımını düşürür; görsel çıktıyı
// değiştirmez. FlatList'lere `{...listPerf}` ile spread edilir.
//   - removeClippedSubviews: ekran dışı satırların native view'larını ayır (Android'de
//     belirgin kazanç; iOS'ta bazı sürümlerde glitch yapabildiği için yalnızca Android).
//   - initialNumToRender/maxToRenderPerBatch/windowSize: ilk render ve batch boyutunu sınırla.
export const listPerf = {
  removeClippedSubviews: Platform.OS === 'android',
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 7,
} as const;
