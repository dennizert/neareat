import React from 'react';
import { render } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import AppIcon from '../../components/AppIcon';
import { ICONS, FALLBACK_ICON } from '../../theme/icons';

// S11-1 — AppIcon + merkezi ikon haritası

describe('AppIcon', () => {
  it('semantik adı doğru Ionicons glyph\'ine map\'ler', () => {
    const { UNSAFE_getByType } = render(<AppIcon name="phone" />);
    expect(UNSAFE_getByType(Ionicons).props.name).toBe(ICONS.phone);
  });

  it('verilen boyut ve rengi iletir', () => {
    const { UNSAFE_getByType } = render(<AppIcon name="heart" size={30} color="#ff0000" />);
    const icon = UNSAFE_getByType(Ionicons);
    expect(icon.props.size).toBe(30);
    expect(icon.props.color).toBe('#ff0000');
  });

  it('bilinmeyen ad → güvenli fallback glyph', () => {
    const { UNSAFE_getByType } = render(<AppIcon name={'nope' as any} />);
    expect(UNSAFE_getByType(Ionicons).props.name).toBe(FALLBACK_ICON);
  });
});

describe('ICONS haritası', () => {
  it('çekirdek semantik isimleri içerir', () => {
    ['phone', 'calendar', 'restaurant', 'search', 'heart', 'star', 'map', 'profile']
      .forEach((k) => expect(ICONS).toHaveProperty(k));
  });
});
