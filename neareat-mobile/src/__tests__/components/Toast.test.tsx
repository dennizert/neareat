import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, type ToastType } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

// S11-2 — Toast + useToast

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Trigger({ message, type }: { message: string; type?: ToastType }) {
  const toast = useToast();
  return <Text onPress={() => toast.show(message, type)}>tetikle</Text>;
}

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ToastProvider>{ui}</ToastProvider>
    </SafeAreaProvider>,
  );
}

describe('Toast / useToast', () => {
  it('başlangıçta toast görünmez', () => {
    renderWithProvider(<Trigger message="Kaydedildi" type="success" />);
    expect(screen.queryByText('Kaydedildi')).toBeNull();
  });

  it('show çağrısı mesajı gösterir', () => {
    renderWithProvider(<Trigger message="Favorilere eklendi" type="success" />);
    fireEvent.press(screen.getByText('tetikle'));
    expect(screen.getByText('Favorilere eklendi')).toBeTruthy();
  });

  it('ikinci show mesajı günceller', () => {
    function MultiTrigger() {
      const toast = useToast();
      return (
        <>
          <Text onPress={() => toast.show('İlk mesaj', 'info')}>ilk</Text>
          <Text onPress={() => toast.show('İkinci mesaj', 'error')}>ikinci</Text>
        </>
      );
    }
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ToastProvider><MultiTrigger /></ToastProvider>
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByText('ilk'));
    expect(screen.getByText('İlk mesaj')).toBeTruthy();
    fireEvent.press(screen.getByText('ikinci'));
    expect(screen.getByText('İkinci mesaj')).toBeTruthy();
    expect(screen.queryByText('İlk mesaj')).toBeNull();
  });
});
