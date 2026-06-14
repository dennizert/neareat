/**
 * PressableScale (Sprint-17 #368) — render + onPress davranışı.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PressableScale from '../../components/PressableScale';

describe('PressableScale', () => {
  it('çocuğunu render eder ve basışta onPress çağırır', () => {
    const onPress = jest.fn();
    render(
      <PressableScale onPress={onPress}>
        <Text>Tıkla</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByText('Tıkla'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled iken onPress çağrılmaz', () => {
    const onPress = jest.fn();
    render(
      <PressableScale onPress={onPress} disabled>
        <Text>Pasif</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByText('Pasif'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
