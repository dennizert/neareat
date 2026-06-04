import React from 'react';
import { render, screen } from '@testing-library/react-native';

// #254 — Eatlas gradient logosu

import EatlasLogo from '../../components/EatlasLogo';

describe('EatlasLogo', () => {
  it('Eat ve Atlas parçalarını render eder', () => {
    render(<EatlasLogo />);
    expect(screen.getByText('Eat')).toBeTruthy();
    expect(screen.getByText('Atlas')).toBeTruthy();
  });

  it('erişilebilirlik etiketi "Eatlas"', () => {
    render(<EatlasLogo />);
    expect(screen.getByLabelText('Eatlas')).toBeTruthy();
  });
});
