import React from 'react';
import { render, screen } from '@testing-library/react-native';

// #254 — Eatlas gradient logosu

import EatlasLogo from '../../components/EatlasLogo';

describe('EatlasLogo', () => {
  it('tek kelime "Eatlas" render eder (bölünmez)', () => {
    render(<EatlasLogo />);
    expect(screen.getByText('Eatlas')).toBeTruthy();
    expect(screen.queryByText('Eat')).toBeNull();
    expect(screen.queryByText('Atlas')).toBeNull();
  });

  it('erişilebilirlik etiketi "Eatlas"', () => {
    render(<EatlasLogo />);
    expect(screen.getByLabelText('Eatlas')).toBeTruthy();
  });
});
