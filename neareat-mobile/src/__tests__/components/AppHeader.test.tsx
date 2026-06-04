import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

// #255 — Ortak AppHeader (sol Eatlas, orta/sağ slotlar)

import AppHeader from '../../components/AppHeader';

describe('AppHeader', () => {
  it('Eatlas logosu + orta + sağ slotlarını render eder', () => {
    render(<AppHeader center={<Text>ORTA</Text>} right={<Text>SAG</Text>} />);
    expect(screen.getByLabelText('Eatlas')).toBeTruthy();
    expect(screen.getByText('ORTA')).toBeTruthy();
    expect(screen.getByText('SAG')).toBeTruthy();
  });
});
