/**
 * ErrorBoundary — global render hatası yakalayıcı (S9-1 #163).
 *
 * Navigation kökünü sarar. Bir alt component render sırasında throw ederse,
 * tüm uygulamanın çökmesi (beyaz ekran) yerine kullanıcıya "Yeniden Dene"
 * fallback ekranı gösterir.
 *
 * Neden class component: React'te hata yakalama yalnızca
 * componentDidCatch / getDerivedStateFromError ile yapılabilir (hook yok).
 *
 * Neden tema hook'u kullanmıyor: ErrorBoundary en dış sarmalayıcı; hata
 * tema/context'ten de kaynaklanmış olabilir. Bu yüzden fallback, context'e
 * bağımlı olmayan sabit (uygulama splash arka planıyla uyumlu) renkler kullanır.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { captureException } from '../services/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Geliştirmede konsola yaz; her durumda Sentry'ye gönder (S14-M3; DSN yoksa no-op).
    if (__DEV__) {
      console.error('[ErrorBoundary] yakalanan hata:', error, info?.componentStack);
    }
    captureException(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🍽️</Text>
        <Text style={styles.title}>Bir şeyler ters gitti</Text>
        <Text style={styles.subtitle}>
          Beklenmeyen bir hata oluştu. Tekrar denemek için aşağıdaki butona dokun.
        </Text>

        {__DEV__ && this.state.error ? (
          <Text style={styles.devError} numberOfLines={6}>
            {this.state.error.toString()}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Yeniden Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // Marka renkleri (tema sabitleri — context'e bağımlı olmadan):
  // koyu zemin #16121C, coral #FF5A3C, açık metin #F7F1EA
  container: {
    flex: 1,
    backgroundColor: '#16121C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F7F1EA',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#B8B2C4',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  devError: {
    fontSize: 12,
    color: '#FF8A80',
    backgroundColor: '#1F1A2B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: '#FF5A3C',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
