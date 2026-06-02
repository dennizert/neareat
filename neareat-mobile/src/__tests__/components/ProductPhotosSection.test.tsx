import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import ProductPhotosSection from '../../components/ProductPhotosSection';

// S10-6 / B8 — "Ürün Fotoğrafları" bölümünün koşullu render'ı.

describe('ProductPhotosSection', () => {
  it('productPhotos doluyken "Ürün Fotoğrafları" başlığını render eder', () => {
    render(
      <ProductPhotosSection
        photos={['https://cdn.example/p1.jpg', 'https://cdn.example/p2.jpg']}
        onPressPhoto={() => {}}
      />,
    );
    expect(screen.getByText('Ürün Fotoğrafları')).toBeTruthy();
  });

  it('productPhotos boşken hiçbir şey render etmez (bölüm gizli)', () => {
    render(<ProductPhotosSection photos={[]} onPressPhoto={() => {}} />);
    expect(screen.queryByText('Ürün Fotoğrafları')).toBeNull();
  });

  it('fotoya basınca onPressPhoto ilgili url ile çağrılır', () => {
    const onPress = jest.fn();
    render(
      <ProductPhotosSection
        photos={['https://cdn.example/p1.jpg', 'https://cdn.example/p2.jpg']}
        onPressPhoto={onPress}
      />,
    );
    const thumbs = screen.UNSAFE_getAllByType(TouchableOpacity);
    expect(thumbs).toHaveLength(2);
    fireEvent.press(thumbs[1]);
    expect(onPress).toHaveBeenCalledWith('https://cdn.example/p2.jpg');
  });
});
