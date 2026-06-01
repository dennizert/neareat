import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ErrorBoundary from '../../components/ErrorBoundary';

// Render sırasında kasıtlı throw eden test component'i
function Boom({ crash }: { crash: boolean }): React.ReactElement {
  if (crash) throw new Error('patladı');
  return <Text>İçerik OK</Text>;
}

describe('ErrorBoundary', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React, yakalanan hatayı console.error'a basar — test çıktısını sustur
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('hata yokken children render eder', () => {
    render(
      <ErrorBoundary>
        <Boom crash={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('İçerik OK')).toBeTruthy();
  });

  it('child throw edince fallback ekranı gösterir, çökmez', () => {
    render(
      <ErrorBoundary>
        <Boom crash={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Bir şeyler ters gitti')).toBeTruthy();
    expect(screen.getByText('Yeniden Dene')).toBeTruthy();
  });

  it('"Yeniden Dene" sonrası hata düzelmişse children tekrar render edilir', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom crash={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Bir şeyler ters gitti')).toBeTruthy();

    // Artık throw etmeyecek child ile ağacı güncelle, sonra reset'e dokun
    rerender(
      <ErrorBoundary>
        <Boom crash={false} />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('Yeniden Dene'));

    expect(screen.getByText('İçerik OK')).toBeTruthy();
  });
});
